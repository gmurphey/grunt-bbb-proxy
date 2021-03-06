/*
 * Grunt Task File
 * ---------------
 *
 * Task: Server
 * Description: Serve the web application.
 * Dependencies: express
 *
 */

module.exports = function(grunt) {

  // TODO: ditch this when grunt v0.4 is released
  grunt.util = grunt.util || grunt.utils;

  var _ = grunt.util._;
  // Shorthand Grunt functions
  var log = grunt.log;

  grunt.registerTask("server", "Run development server.", function(prop) {
    var options;
    var props = ["server"];

    // Keep alive
    var done = this.async();

    // If a prop was passed as the argument, use that sub-property of server.
    if (prop) { props.push(prop); }

    // Defaults set for server values
    options = _.defaults(grunt.config(props) || {}, {
      favicon: "./favicon.ico",
      index: "./index.html",

      port: process.env.PORT || 8000,
      host: process.env.HOST || process.env.HOSTNAME || "127.0.0.1"
    });

    options.folders = options.folders || {};

    // Ensure folders have correct defaults
    options.folders = _.defaults(options.folders, {
      app: "./app",
      assets: "./assets",
      dist: "./dist",
      config: "./config"
    });

    options.files = options.files || {};

    // Ensure files have correct defaults
    options.files = _.defaults(options.files, {
      "app/config.js": "app/config.js"
    });

    // Run the server
    grunt.helper("server", options);

    // Fail task if errors were logged
    if (grunt.errors) { return false; }

    log.writeln("Listening on http://" + options.host + ":" + options.port);
  });

  grunt.registerHelper("server", function(options) {
    // Require libraries.
    var fs = require("fs");
    var path = require("path");
    var stylus = require("stylus");
    var express = require("express");

    // CORS Middleware
    var allowCrossDomain = function(req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

      // intercept OPTIONS method
      if ('OPTIONS' == req.method) {
        res.send(200);
      }
      else {
        next();
      }
    };

    // HOST mapping for clients
    var hostMapping = {
      "newsplace.toshiba.com": "toshiba"
    };

    // If the server is already available use it.
    var site = options.server ? options.server() : express.createServer();
    site.use(allowCrossDomain);

    // Allow users to override the root.
    var root = _.isString(options.root) ? options.root : "/";

    // Process stylus stylesheets.
    site.get(/.styl$/, function(req, res) {
      var url = req.url.split("assets/css/")[1];
      var file = path.join("assets/css", url);

      fs.readFile(file, function(err, contents) {
        var processer = stylus(contents.toString());

        processer.set("paths", ["assets/css/"]);
        processer.render(function(err, css) {
          res.header("Content-type", "text/css");
          res.send(css);
        });
      });
    });

    // Process config url
    site.get("/config.json", function(req, res, next) {
      var client,
          env = process.env,
          host = env.HOST || env.HOSTNAME;

      // Use a default if we're on opal
      if (!host || /opal/.test(host)) {
        return res.redirect("/config/toshiba/config.json", 302);
      }
      // Use a default if the hostMapping is empty
      else {
        client = hostMapping[host] || "toshiba";
      }
      return res.redirect("/config/" + client + "/config.json", 302);
    });

    // Process proxy urls
    site.get("/proxy", function(req, res, next) {
      var url = require("url");
      var http = require("http");
      var proxy_url = decodeURIComponent(req.query.proxyto || "");
      var proxy_opts = url.parse(proxy_url);

      // Make the request
      http.get(proxy_opts, function(http_res) {
        var body = "";
        http_res.setEncoding('utf8');
        http_res.on('data', function(chunk) {
          body += chunk;
        });
        http_res.on('end', function() {
          body = body.replace(/^\xEF\xBB\xBF/, '');
          var vamResponse = JSON.parse(body);
          res.json(vamResponse.results, 200);
        });
        http_res.on('close', function(err) {
          res.send(err, 500);
        });
      });
    });

    // Handle config responses with caching, etc.
    site.get("/config/:client/*", function(req, res, next) {
      // Cache for one day
      var expires = Date.now() * (60 * 60 * 24);
      res.header("Cache-Control", "maxage=" + expires);
      next();
    });

    // Map static folders.
    Object.keys(options.folders).sort().reverse().forEach(function(key) {
      site.get(root + key + "/*", function(req, res, next) {
        // Find filename.
        var filename = req.url.slice((root + key).length);

        res.sendfile(path.join(options.folders[key] + filename));
      });
    });

    // Map static files.
    if (_.isObject(options.files)) {
      Object.keys(options.files).sort().reverse().forEach(function(key) {
        site.get(root + key, function(req, res) {
          return res.sendfile(options.files[key]);
        });
      });
    }

    // Serve favicon.ico.
    site.use(express.favicon(options.favicon));

    // Ensure all routes go home, client side app..
    site.get("*", function(req, res) {
      fs.createReadStream(options.index).pipe(res);
    });

    // Actually listen
    site.listen(options.port, options.host);
  });

};
