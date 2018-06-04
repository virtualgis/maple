/* Maple - A Modern Web Mapping Application
* 
* Copyright (C) 2018 VirtualGIS
* 
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
* 
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
* 
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>. */
define(["doh/runner", "tests/conf", "dojo/request", 
  "gisView/config/project", "gisView/helpers/errorHandler", 
  "dojo/_base/array",
  "gisView/helpers/map/layers", "dojox/json/ref", "dojo/text!./configurations.json"], 
  function(doh, conf, request, project, errorHandler, 
    array,
    mapLayers, json, configurations){
    configurations = json.fromJson(configurations);

    function keysCount(obj){
      var count = 0;
      for (var i in obj) count++;
      return count;
    }

    function testConfiguration(projectName, configFile, opts){
      opts = opts || {};

      var deferred = new doh.Deferred();

      project.init(projectName, configFile).then(function(){
        doh.assertTrue(project.config !== undefined, "Config exists");
        doh.assertTrue(project.config.name === projectName, "Project name is set");
        doh.assertTrue(project.config.disclaimer !== undefined, "Disclaimer is set");
          
        doh.assertTrue(typeof project.config.popups.get === "function", "Popup get is set.");
        doh.assertTrue(project.config.popups._loaded, "Popup modules are loaded");

        doh.assertTrue(typeof project.config.map.getInitialExtent === "function", "Map methods are set.");

        if (opts.expectProfileOverride){
          doh.assertTrue(project.config._overridenBy === project.config.loadedConfiguration.replace(/json$/i, "override.json"), "Profile override is in effect.");
        }

        array.forEach(["Search", "Query", "Bookmark", "eTime", "WMSLooping", "Legend", "Routes", "Locate", "ImportDataFile", "Edit"], function(widget){
          if (project.config.hasWidget[widget]){
            if (widget === "Search"){
              doh.assertTrue(project.config.widgets.Search.primary !== undefined, "Primary search widget is set.");
            }else{
              doh.assertTrue(project.config.widgets[widget] !== undefined, widget + " widgets have loaded");
            }
            doh.assertTrue(project.config.widgetcontainer.findAllFlat(widget).length > 0, "Can find " + widget + " widgets");
            doh.assertTrue(project.config.widgetcontainer.findFirst(widget) !== null, "Can find single instances of " + widget + " widgets");
          }else{
            if (widget === "Search"){
              doh.assertTrue(project.config.hasWidget.Search === false && project.get("config.widgets.Search.primary") === undefined, "Search widget is disabled.");
            }
            doh.assertTrue(project.config.widgetcontainer.findAllFlat(widget).length === 0, "No " + widget + " widgets found");
            doh.assertTrue(project.config.widgetcontainer.findFirst(widget) === null, "No single instances of " + widget + " widgets found");
          }
        });

        doh.assertTrue(project.config.getPath("test") === "/config/projects/" + project.config.name + "/test", "getAsset works");

        doh.assertTrue(project.config.profiles !== undefined, "Profiles object is set");

        doh.assertTrue(Object.prototype.toString.apply(project.config.map.basemaps.getLayers()) === "[object Array]", "Can retrieve basemap layers");

        request.get("/config/projects/" + projectName + "/project.json", {
            handleAs: "json"
        }).then(function(projectJson){
          var configFileToLoad = configFile === undefined ? 
                                  (projectJson.profiles['default'] || "config.json") : 
                                  configFile;
          doh.assertTrue(project.config.loadedConfiguration === configFileToLoad,
              "Loaded configuration matches json file requested");
          
          if (projectJson.profiles.multiple){
            doh.assertTrue(project.config.widgets.ConfigSelectSplash.ConfigSelectSplashWidget !== undefined, "Splash widget loaded for multiple configurations");
          }else{
            doh.assertTrue(project.config.widgets.ConfigSelectSplash === undefined, "Don't load splash widget if single profile.");
          }

          // Check overrides
          for (var modulePath in project.modulesOverridesJson){
            var widget = project.get("config." + modulePath.replace(/\//g, "."), null);
            if (widget){
              doh.assertTrue(widget._overridenBy !== undefined, "Overriden widget is marked as overriden.");
              console.log("TEST: Overrided " + modulePath);
            }
          }

          // Test layers, which will raise warnings
          // if some popups are not accessible.
          mapLayers.getOperationalLayers({
            test: true
          });

          deferred.resolve();
        }, doh.assertTrue);
      });

      return deferred;
    }

    var testCases = [
      {
        name: "project.init('sax')",
        setUp: function(){},
        runTest: function(){
          return testConfiguration('sax', undefined, {
            expectProfileOverride: true
          });
        },
        tearDown: function(){},
        timeout: 1000
      },
      {
        name: "project.get()",
        runTest: function(){
          doh.assertEqual(project.get("config.name", "default"), "sax", "Returning value that exists");
          doh.assertEqual(project.get("config.name.nonexistant", "default"), "default", "Returning default value on non-existant item");
          doh.assertTrue(project.get("", "default") === "default", "Returns default on empty string");
        }
      },

      // Time to break things :)
      {
        name: "project.init('sax', 'invalid.json')",
        setUp: function(){},
        runTest: function(){
          var deferred = new doh.Deferred();

          // This will call errorHandler.die()
          errorHandler.setDieCallback(function(error){
            doh.assertTrue(error.indexOf("FATAL: Request to load sax failed.") === 0, "Could not load bogus project.");
            deferred.resolve();
          });
          testConfiguration("sax", "invalid.json");

          return deferred;
        },
        tearDown: function(){
          errorHandler.clearDieCallback();
        },
        timeout: 1000
      },
      {
        name: "project.loadProfile('bogus.json') (with and without callback)",
        setUp: function(){},
        runTest: function(){
          var deferred = new doh.Deferred();
          var numberOfErrorHandlerCalls = 0;

          errorHandler.setDieCallback(function(error){
            numberOfErrorHandlerCalls++;

            doh.assertTrue(error.indexOf("FATAL: Request to load sax failed. Does a bogus.json file exist?") === 0, "Could not load bogus profile.");
            doh.assertTrue(numberOfErrorHandlerCalls === 1, "Error handler is called once");

            project.loadProfile('bogus2.json', function(){
              doh.assertFalse(true, "Success callback (2) should not have been called");
            }, function(err){
              doh.assertTrue(err.indexOf("FATAL: Request to load sax failed. Does a bogus2.json file exist?") === 0, "Could not load bogus project (callback).");
              deferred.resolve();
            });
          });

          project.init('sax', 'config-general.json').then(function(){
            doh.assertTrue(project.config !== undefined, "Config exists");

            project.loadProfile('bogus.json', function(){
              doh.assertFalse(true, "Success callback should not have been called");
            });
          });

          return deferred;
        },
        tearDown: function(){
          errorHandler.clearDieCallback();
        },
        timeout: 1000
      },
      {
        name: "project.init('bogus')",
        setUp: function(){},
        runTest: function(){
          var deferred = new doh.Deferred();

          // This will call errorHandler.die()
          errorHandler.setDieCallback(function(error){
            doh.assertTrue(error.indexOf("FATAL: Request to load bogus failed.") === 0, "Could not load bogus project.");
            deferred.resolve();
          });
          testConfiguration("bogus");

          return deferred;
        },
        tearDown: function(){
          errorHandler.clearDieCallback();
        },
        timeout: 1000
      }
    ];

    // Add init test cases
    for (var i = 0; i < configurations.init.length; i++){
      (function(i){
        var conf = configurations.init[i];
        testCases.push({
            name: "project.init('" + conf.project + "', '" + conf.params.configFile + "')",
            setUp: function(){},
            runTest: function(){
              errorHandler.setDieCallback(function(error){
                console.warn("project.init('" + conf.project + "', '" + conf.params.configFile + "') failed with error: " + error);
              });

              return testConfiguration(conf.project, conf.params.configFile);
            },
            tearDown: function(){},
            timeout: 1000
          });
      })(i);
    }

    doh.register("Project Module", testCases);
});
