'use strict';

var path = require('path');

module.exports = function (grunt) {

  var _ = grunt.util._;

  grunt.registerMultiTask('chromeManifest', '', function () {
    var options = this.options({
      buildnumber: undefined,
      background: null,
      uglify: 'uglify',
      cssmin: 'cssmin',
      indentSize: 4,
      removeFields: ['key']
    });

    // Correct value of option for backwarding compatibility
    if (options.buildnumber === true) {
      options.buildnumber = 'both';
    }

    this.files.forEach(function (file) {
      var src = file.src[0];
      var dest = file.dest;
      var srcManifest = file.manifest || path.join(src, 'manifest.json');
      var concat = grunt.config('concat') || {};
      var uglify = grunt.config(options.uglify) || {};
      var cssmin = grunt.config(options.cssmin) || {};
      var manifest = grunt.file.readJSON(srcManifest);
      var originManifest = _.clone(manifest, true);
      var buildnumber = manifest.version.split('.');
      var background = null;

      // Detect types of background, app, extension and page
      if (manifest.app && manifest.app.background) {
        background = manifest.app.background;
      } else if (manifest.background && manifest.background.scripts) {
        background = manifest.background;
      }

      if (background) {
        if (options.background.target) {
          var target = path.join(dest, options.background.target);

          // update concat config for scripts in background field.
          concat.background = {
            src: [],
            dest: target
          };

          // exclude the scripts from concat task
          _.each(background.scripts, function (script) {
            if (_.indexOf(options.background.exclude, script) === -1) {
              concat.background.src.push(path.join(src, script));
            }
          });

          // Add concated background js to uglify task
          uglify[target] = target;

          // set script from scripts in target
          background.scripts = [options.background.target];
        } else {
          // remove background.scripts if target is not given
          delete background.scripts;
        }
      }

      // Add contents css to cssmin task
      // Add contents script to concat task.
      // NOTE: only work with one content script match
      for (var i = 0; i < manifest.content_scripts.length; i++) {
        var suffix = '';

        if (manifest.content_scripts.length > 1) {
          suffix = i+1;
        }

        var content_scripts_target = path.join(dest, 'scripts/contentscript'+suffix+'.js');
        concat['content_scripts'+suffix] = {
          src: [],
          dest: content_scripts_target
        };

        _.each(manifest.content_scripts[i].js, function (script) {
          concat['content_scripts'+suffix].src.push(path.join(src, script));
        });

        uglify[content_scripts_target] = content_scripts_target;
        manifest.content_scripts[i].js = ['scripts/contentscript'+suffix+'.js'];

        if (manifest.content_scripts[i].css && manifest.content_scripts[i].css.length) {
          var content_scripts_css_target = path.join(dest, 'scripts/contentscript'+suffix+'.css');
          concat['content_scripts_css'+suffix] = {
            src: [],
            dest: content_scripts_css_target
          };

          _.each(manifest.content_scripts[i].css, function (css) {
            concat['content_scripts_css'+suffix].src.push(path.join(src, css));
          });

          cssmin[content_scripts_css_target] = content_scripts_css_target;
          manifest.content_scripts[i].css = ['styles/contentscript'+suffix+'.css'];
        }
      }


      // Update each grunt configs.
      grunt.config('concat', concat);
      grunt.config(options.cssmin, cssmin);
      grunt.config(options.uglify, uglify);

      // Increase build number that from origin manifest
      if ((/both|dest/).test(options.buildnumber)) {
        var versionUp = function (numbers, index) {
          if (!numbers[index]) {
            grunt.fail.fatal('Build number has overflowing ' + numbers);
            throw 'Build number overflow ' + numbers;
          }
          if (numbers[index] + 1 <= 65535) {
            numbers[index]++;
            return numbers.join('.');
          } else {
            versionUp(numbers, ++index);
          }
        };

        // Update version of dest manifest.json
        manifest.version = versionUp(buildnumber, buildnumber.length - 1);

        // Update version of origin manifest.json
        if (options.buildnumber === 'both') {
          originManifest.version = manifest.version;
          grunt.file.write(srcManifest, JSON.stringify(originManifest, null, options.indentSize));
        }

        grunt.log.writeln('Build number has changed to ' + grunt.log.wordlist(buildnumber));
      } else if ((/^\d+(\.\d+){0,3}$/).test(options.buildnumber)) {
        // Set version from string
        manifest.version = options.buildnumber;
        grunt.log.writeln('Build number has changed to ' + manifest.version);
      }

      // Overwrite options
      if (options.overwrite) {
        for (var key in options.overwrite) {
          manifest[key] = options.overwrite[key];
        }
      }

      //remove fields
      for (var fieldKey in options.removeFields) {
        delete manifest[options.removeFields[fieldKey]];
      }

      // Write updated manifest to destination.
      grunt.file.write(path.join(dest, 'manifest.json'),
            JSON.stringify(manifest, null, options.indentSize));
    });
  });
};
