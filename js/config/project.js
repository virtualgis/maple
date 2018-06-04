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
define(["dojo/Deferred", "dojo/request", 
	"esri/geometry/Extent", "esri/SpatialReference",
	"dojox/json/ref", "dojo/text!/config/defaults/project.json",
	"maple/helpers/utils", "dojo/_base/array", "dojo/_base/lang", "maple/helpers/errorHandler"], 
	function(Deferred, request, Extent, SpatialReference,
		jsonRef, defaults, utils, array, lang, errorHandler){
	"use strict";
	
	defaults = jsonRef.fromJson(defaults);
	utils.removeParents(defaults); // Avoid DAG cycle during clone

	// Define module settings and override rules here
	var widgetProps = {
		search: {
			// @param module JSON of module ([moduleName].json)
			// @param override JSON of override ([moduleName].override.json)
			// @return nothing, merge changes destructively in module object
			overrideRules: function(module, override){
				function getLayerByName(name){
					var layerList = module.configuration.layers.layer;
					for (var i in layerList){
						if (layerList[i].name == name){
							return layerList[i];
						}
					}
					return null;
				}

				function getFieldByName(layer, name){
					for (var i in layer.fields.field){
						if (layer.fields.field[i].name == name){
							return layer.fields.field[i];
						}
					}
					return null;
				}

				for (var layerName in override.fieldTags){
					var layer = override.fieldTags[layerName];
					var moduleLayer = getLayerByName(layerName);
					if (moduleLayer){
						for (var fieldName in layer){
							var field = layer[fieldName];

							var moduleField = getFieldByName(moduleLayer, fieldName);
							if (moduleField){
								// Copy properties over
								for (var k in field){
									moduleField[k] = field[k];
								}
							}
						}
					}
				}

				// Copy simple items
				array.forEach(['searchPlaceholder', 'excludeLayers'], function(item){
					if (override[item]) module.configuration[item] = override[item];
				});

				// Mark layers as excluded (if applicable)
				if (module.configuration.excludeLayers){
					array.forEach(module.configuration.excludeLayers, function(layerName){
						var layer = getLayerByName(layerName);
						layer.exclude = true;
					});
				}
			},

			// Handle merging of two modules when they need to be
			// aggregated
			merge: function(module_dst, module_src){
				// Copy layers
				module_src.layers.layer.forEach(function(layer){
					module_dst.layers.layer.push(lang.clone(layer));
				});
				module_dst.searchPlaceholder = module_dst.searchPlaceholder || module_src.searchPlaceholder;

				return module_dst;
			}
		}
	};

	var exp = {
		init: function(projectName, preferredConfig){
			var done = new Deferred();
			var that = this;

			// Load main config
			request.get("/config/projects/" + projectName + "/project.json", {
		        handleAs: "json"
		    }).then(function(project){
		    	if (!project.server) throw new Error("The 'server' property is missing from project.json. Please configure project.json with a 'server' property and reload the page.");

		    	project.overrides = project.overrides || {};
		    	project.profiles = project.profiles || {multiple: false};
		    	project.modulesOverridesJson = {};

		    	// Populate exp with methods
		    	// This way we can leverage closures to encapsulate projectName, project, etc.
		    	exp.loadProfile = function(json, done, fail){
		    		var handleLoadProfileError = function(err, rethrow){
		    			// If we specify a callback, we invoke that instead of the default error handler
		    			if (fail !== undefined) fail(err);
		    			else errorHandler.die(err, rethrow);
		    		};

		    		var loadMainConfig = function(profileOverride){	
						request.get("/config/projects/" + projectName + "/profiles/" + json, {
					        handleAs: "json"
					    }).then(function(configJson){
					    	// Check profile validity
					    	// Some profiles coming from ESRI's Flex Viewer
					    	// Are only a splash page configuration
					    	if (!configJson.configuration.map || 
					    		!configJson.configuration.map.operationallayers){
					    		handleLoadProfileError("FATAL: Configuration file invalid (missing map or operationallayers).");
					    		return;
					    	}

					    	// Always expect an array of layers, even if there's only one layer
					    	utils.arrayify(configJson, "configuration.map.operationallayers.layer");

					    	// Set default values
					    	configJson.configuration = utils.mixinDeep(lang.clone(defaults.configuration), configJson.configuration);

					    	// Add extra fields
					    	configJson.configuration.name = projectName;
					    	configJson.configuration.server = project.server;
					    	configJson.configuration.profiles = project.profiles;
					    	configJson.configuration.loadedConfiguration = json;

					    	// Handle profile override rules
					    	if (profileOverride){
					    		configJson.configuration._overridenBy = json.replace(/json$/i, "override.json");

					    		// Snapping layers
					    		if (profileOverride.snappingLayers){
					    			array.forEach(configJson.configuration.map.operationallayers.layer, function(layer){
					    				if (array.indexOf(profileOverride.snappingLayers, layer.label) !== -1){
					    					layer.snapping = true;
					    				}
					    			});
					    		}

					    		// Post login message
					    		if (profileOverride.postLoginMessage){
					    			configJson.configuration.postLoginMessage = profileOverride.postLoginMessage;
					    		}

					    		// Display levels
					    		if (profileOverride.displayLevels){
					    			array.forEach(configJson.configuration.map.operationallayers.layer, function(layer){
					    				if (profileOverride.displayLevels[layer.label]){
					    					layer.displaylevels = profileOverride.displayLevels[layer.label];
					    				}
					    			});
					    		}
					    	}

					    	// Create configuration object
					    	// This is where you can define helper methods
					    	var config = {
					    		getPath: function(relativePath){
					    			return "/config/projects/" + this.name + "/" + relativePath;
					    		},

						    	map: {
									getInitialExtent: function(){
										if (this.initialextent && this.wkid){
											var parts = this.initialextent.split(" ");
											var xmin = parseFloat(parts[0]),
												ymin = parseFloat(parts[1]),
												xmax = parseFloat(parts[2]),
												ymax = parseFloat(parts[3]);
											return new Extent(xmin, ymin, xmax, ymax, new SpatialReference({wkid: this.wkid}));
										}

										console.warn("getInitiaExtent() returns null, initialextent and/or wkid missing from config.");
										return null;
									},

									getLods: function(){
										if (this.lods && this.lods.lod){
											// Clone
											var arr = this.lods.lod.slice(0);

											// Add "level" property
											for (var i in arr) arr[i].level = parseInt(i);
											return arr;
										}else return [];
									},

									basemaps:{
										getLayers: function(){
											if (Object.prototype.toString.apply(this.layer) === "[object Object]"){
												return [this.layer];
											}else if (this.layer){
												return this.layer;
											}else{
												return [];
											}
										}
									}
								},

								popups:{
									// @param popupConfig (XMl path such as popups/PopUp_tracts.xml)
									get: function(popupConfig){
										var key = (popupConfig.match(/[\/]?([^\/]+)\.xml$/) || {})[1];
										if (!key || !this[key] || !this[key].configuration){
											console.warn("Could not find popup: " + popupConfig + ". Is it in popups.json?", projectName);
											return null;
										}

										return this[key].configuration;
									}
								},

								widgetcontainer:{
									// Retrieve all widgets of a certain type
									// maintaining the item/subitems hierarchy
									findAll: function(type){
										var result = [];
										var regex = new RegExp("^widgets/" + type + "/([^\.]+)\.xml$");

										function processItem(widget, parent){
											var key = (widget.config.match(regex) || {})[1];
											if (key){
												if (config.widgets[type][key]){
													parent.push({
														label: widget.label,
														icon: widget.icon,
														config: config.widgets[type][key]
													});
												}else{
													console.warn("Cannot find query widget: " + widget.config, config.name);
												}									
											}
										}

										if (this.widget){
											array.forEach(this.widget, function(widget){
												processItem(widget, result);
											});
										}
										if (this.widgetgroup){
											array.forEach(this.widgetgroup, function(widgetgroup){
												var widgetsInGroup = [];
												array.forEach(widgetgroup.widget, function(widget){
													processItem(widget, widgetsInGroup);
												});
												if (widgetsInGroup.length > 0){
													result.push({
														category: true,
														label: widgetgroup.label,
														icon: widgetgroup.icon,
														widgets: widgetsInGroup
													});
												}
											});
										}

										return result;
									},

									// Same as findAll, but discards hierarchy info
									// (flatten the list)
									findAllFlat: function(type){
										var widgets = this.findAll(type);
										var result = [];
										array.forEach(widgets, function(widget){
											if (widget.category){
												array.forEach(widget.widgets, function(w){
													result.push(w);
												});
											}else{
												result.push(widget);
											}
										});
										return result;
									},

									// Calls findAllFlat and returns the first result
									// Useful when looking for a widget that we expect to
									// be a single instance.
									findFirst: function(type){
										var results = this.findAllFlat(type);
										if (results.length > 0){
											return results[0];
										}else{
											return null;
										}
									}
								}
					    	};

					    	// Flatten widgetcontainer (some entries might be arrays)
					    	// Note that this will discard any widgets that is included 
					    	// in the subsequent containers. A future solution could include
					    	// flattening the container to include all widgets.
							if (Object.prototype.toString.apply(configJson.configuration.widgetcontainer) === "[object Array]"){
								configJson.configuration.widgetcontainer = configJson.configuration.widgetcontainer[0];
							}

					    	// Combine with module
							utils.mixinDeep(config, configJson.configuration);

							// Export
							exp.config = config;

							// Setup widgets
							config.widgets = {};

							config.hasWidget = {}; // hasWidget["Search"] = true, hasWidget["Query"] = ...

							// Generate module list
							var modules = {
								"popups": {} // Always load popups
							};

							// Multi profile splash screen
							if (project.profiles.multiple){
								modules["widgets/ConfigSelectSplash/config"] = {
										importFromCollection: ["widgets/ConfigSelectSplash/ConfigSelectSplashWidget"]
									};
							}

							// Make widgetgroups and widget objs with a single item an array
							utils.arrayify(config, "widgetcontainer.widgetgroup");
							utils.arrayify(config, "widgetcontainer.widget");

							// Add widgets defined via overrides to container
							if (profileOverride && profileOverride.includeWidgets){
								config.widgetcontainer.widget = config.widgetcontainer.widget || [];

								array.forEach(profileOverride.includeWidgets, function(widget){
									config.widgetcontainer.widget.push(widget);
								});
							}

							// Find widgets (scan all of these paths)
							var widgetConfigObjs = [];
							if (utils.hasProp(config, "widgetcontainer.widget")) widgetConfigObjs.push(config.widgetcontainer.widget);
							if (utils.hasProp(config, "widgetcontainer.widgetgroup")){
								for (var i = 0; i < config.widgetcontainer.widgetgroup.length; i++){
									if (config.widgetcontainer.widgetgroup[i].widget) widgetConfigObjs.push(config.widgetcontainer.widgetgroup[i].widget);
								}
							}

							var widgetImportSettings = [
								{
									key: "Search",
									urlTest: /Search\/SearchWidget\.swf/i,
									options: {
										overrideRules: widgetProps.search.overrideRules,
										merge: widgetProps.search.merge,
										exportAs: "widgets/Search/primary" // merge all into one
									}
								},
								{
									key: "Query",
									urlTest: /Query\/QueryWidget\.swf/i,
								},
								{
									key: "Bookmark",
									urlTest: /Bookmark\/BookmarkWidget\.swf/i,
								},
								{
									key: "eTime",
									urlTest: /eTime\/eTimeWidget\.swf/i,
								},
								{
									key: "WMSLooping",
									urlTest: /WMSLooping\/WMSLoopingWidget\.swf/i,
								},
								{
									key: "Legend",
									urlTest: /Legend\/LegendWidget\.swf/i
								},
								{
									key: "Link",
									urlTest: /Link\/LinkWidget\.swf/i
								},
								{
									key: "Routes",
									urlTest: /Routes\/RoutesWidget\.swf/i
								},
								{
									key: "Locate",
									urlTest: /Locate\/LocateWidget\.swf/i
								},
								{
									key: "ImportDataFile",
									urlTest: /ImportDataFile\/ImportDataFileWidget\.swf/i
								},
								{
									key: "Edit",
									urlTest: /Edit\/EditWidget\.swf/i
								}
							];

							// Initialize hasWidget property
							for (var j = 0; j < widgetImportSettings.length; j++){
								var wis = widgetImportSettings[j];
								if (config.hasWidget[wis.key] === undefined) config.hasWidget[wis.key] = false;
							}
							
							array.forEach(widgetConfigObjs, function(widgetConfigObj){
								
								// Find widgets
								for (var i = 0; i < widgetConfigObj.length; i++){
									var widget = widgetConfigObj[i];

									for (var j = 0; j < widgetImportSettings.length; j++){
										var wis = widgetImportSettings[j];
										var modulePath = "widgets/" + wis.key + "/config";

										if (wis.urlTest.test(widget.url)){
											if (!modules[modulePath]){
												modules[modulePath] = wis.options || {};
												modules[modulePath].importFromCollection = [];
											}
											modules[modulePath].importFromCollection.push(widget.config.replace(/\.xml$/i, ""));

											config.hasWidget[wis.key] = true;
											break;
										}
									}
								}
							});

							// Calculate convenience array with module name's list,
							// remove duplicates from importFromCollection
							// calculate number of expected modules to load,
							var modulesList = [];
							var modulesToLoadCount = 0;
							for (var k in modules){
								if (modules[k].importFromCollection){
									modules[k].importFromCollection = utils.removeDuplicates(modules[k].importFromCollection);
									modulesToLoadCount += modules[k].importFromCollection.length;
								}else{
									modulesToLoadCount += 1;
								}
								
								modulesList.push(k);
							}

							// Destructive for module
							var overrideRules = function(moduleName, module, override){
								if (modules[moduleName].overrideRules){
									modules[moduleName].overrideRules(module, override);

									// Mark for unit test check
									module.configuration._overridenBy = moduleName + ".override.json";
								}
							};

							// @param opts (optional)
							// {
							//		exportAs: module to export (create and alias) to. Multiple aliases will merge
							// }
							var assignModule = function(moduleName, module, opts){
								module = lang.clone(module);

								// Create namespace tree from string
								// widgets/search --> {widget:{search:...}}
								var namespaces = moduleName.split("/");
								var current = exp.config;
								var previous = null;
								array.forEach(namespaces, function(namespace){
									current[namespace] = current[namespace] || {};
									previous = current;
									current = current[namespace];
								});
								var target = previous[namespaces[namespaces.length - 1]];
									
								// Manual merge will only copy over certain fields
						    	if (opts.exporting && target._loaded && modules[opts.realModuleName] && modules[opts.realModuleName].merge){
						    		modules[opts.realModuleName].merge(target, module.configuration);
						    	}else{
						    		utils.mixinDeep(target, module.configuration);
						    	}

								// Recursively call to create export reference
						    	if (opts.exportAs){
						    		assignModule(opts.exportAs, module, {exporting: true, realModuleName: moduleName});
						    	}
							};

							// Load modules
							var modulesLoadedCount = 0;

							var moduleLoaded = function(moduleName, module){
								if (module){
									var exportAs = modules[moduleName].exportAs;
									module.configuration._loaded = true; // Mark for testing

									// Check overrides
									var override = project.modulesOverridesJson[moduleName];
									
									if (override){
								    	overrideRules(moduleName, module, override);
								    	assignModule(moduleName, module, {exportAs: exportAs});
								    	moduleLoadedDone();
									}else{
										assignModule(moduleName, module, {exportAs: exportAs});
										moduleLoadedDone();
									}
								}else{
						    		console.warn("Could not load " + moduleName + " (either missing or mispelled)", projectName);
									moduleLoadedDone();
								}

								function moduleLoadedDone(){
									// console.log(moduleName, modulesLoadedCount + 1);
									// console.log(modulesToLoadCount);
									if (++modulesLoadedCount === modulesToLoadCount){
					    				console.log("Configuration loaded for " + projectName);
								    	done();
									}				    	
								}
							};

							var moduleIndexToLoad = 0;
							function loadNextModule(){
								var moduleName = modulesList[moduleIndexToLoad];
								
								if (moduleName){
									moduleIndexToLoad++;
									
									request.get("/config/projects/" + projectName + "/" + moduleName + ".json", {
								        handleAs: "json"
								    }).then(function(json){
								    	// Is this file a collection of multiple modules
								    	// or is it a single module?
								    	if (json.configuration){
								    		// Single
								    		moduleLoaded(moduleName, json);
								    		loadNextModule();
								    	}else{
								    		// Collection
								    		// moduleName = widgets/<widgetName>/config (the collection)

								    		var moduleNameRoot = moduleName.replace(/config$/i, "");
								    		var actualModuleName;  // Extracted from collection

								    		array.forEach(modules[moduleName].importFromCollection, function(actualModuleName){
								    			var name = (actualModuleName.match(/\/([^\/]+)$/) || {})[1];

								    			if (json[name]){
									    			// Copy reference to properties
											    	modules[actualModuleName] = modules[moduleName];
										    		moduleLoaded(actualModuleName, json[name]);
								    			}else{
									    			moduleLoaded(actualModuleName, false);
									    		}
								    		});
							    			loadNextModule();
								    	}
								    }, function(){
								    	moduleLoaded(moduleName, false);
								    	loadNextModule();
								    });
								}
							}
							loadNextModule();
						}, function(){
							handleLoadProfileError("FATAL: Request to load " + projectName + " failed. Does a " + json + " file exist?", true);
						});
					}; // end loadMainConfig

					console.log("Loading " + projectName + ": " + json);

					var moduleOverrideFiles = [];
					for (var overrideFile in project.overrides){
						if (/^widgets/i.test(overrideFile)){
							moduleOverrideFiles.push("/config/projects/" + projectName + "/" + overrideFile + ".json");
						}
					}

			    	utils.loadMultipleJsonFiles(moduleOverrideFiles).then(function(jsonFiles){
			    		
			    		// Populate modulesOverridesJson
		    			var moduleName;
		    			var moduleConfig;
			    		for (var path in jsonFiles){
			    			moduleName = (path.match(/\/widgets\/([^\/]+)\/overrides\.json$/i) || {})[1];
			    			if (moduleName){
			    				moduleConfig = jsonFiles[path];
								for (var widgetFile in moduleConfig){
			    					project.modulesOverridesJson["widgets/" + moduleName + "/" + widgetFile] = moduleConfig[widgetFile];
								}
			    			}else{
			    				console.warn("WARNING: cannot find widget name for " + path);
			    			}
			    		}

			    		// Check for profile overrides
			    		var profileName = json.replace(/\.json$/i, '');
			    		if (project.overrides["profiles/" + profileName]){
			    			console.log("Found profile override");
			    			request.get("/config/projects/" + projectName + "/profiles/" + profileName + ".override.json", {
						        handleAs: "json"
						    }).then(loadMainConfig, function(){
						    	handleLoadProfileError("FATAL: Request to load " + projectName + " failed. Does a " + profileName + ".override.json file exist?", true);
						    });
			    		}else{
			    			loadMainConfig();
			    		}
			    	}, function(err){
						handleLoadProfileError("FATAL: Request to load override files failed. Do all files referenced by project.json exist? " + err.message, true);
			    	});
		    		
				}; // end loadProfile

		    	if (project.profiles.multiple){
		    		var defaultConfig = preferredConfig || project.profiles['default'] || 'config.json';
		    		exp.loadProfile(defaultConfig, done.resolve);
		    	}else{
		    		exp.loadProfile('config.json', done.resolve);
		    	}
		    }, function(){
		    	errorHandler.die("FATAL: Request to load " + projectName + " failed. Does a project.json file exist?", true);
		    });

		    return done;
		},

		// Safe way to access a property
		// in case the property does not exist
		get: function(prop, defaultValue){
			return utils.get(this, prop, defaultValue);
		}
	};

	return exp;
});