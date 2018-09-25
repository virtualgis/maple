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
define(["dojo/_base/array", "maple/config/project", 
		"esri/layers/ArcGISDynamicMapServiceLayer", 
		"esri/layers/ArcGISTiledMapServiceLayer",
		"esri/layers/FeatureLayer",
		"maple/helpers/map/infoTemplate",
		"maple/helpers/utils",
		"esri/dijit/BasemapLayer",
		"dojo/_base/lang",
		"dojo/on",
		"dojo/request",
		"maple/helpers/auth",
		"dojo/Deferred",
		"esri/geometry/Extent",
		"maple/helpers/map/geometries",
		"esri/layers/ImageParameters"], 
	function(array, project, 
		ArcGISDynamicMapServiceLayer, ArcGISTiledMapServiceLayer,
		FeatureLayer, infoTemplate, utils, BasemapLayer, lang, on,
		request, auth, Deferred, Extent, mapGeometries, ImageParameters){
	"use strict";

	function instantiateLayer(type, url, opts){
		switch(type){
			case 'dynamic':
				return new ArcGISDynamicMapServiceLayer(url, opts);
			case 'tiled':
				return new ArcGISTiledMapServiceLayer(url, opts);
			case 'feature':
				return new FeatureLayer(url, opts);
			default:
				console.warn("Unknown layer type: " + type + ", skipping...");
				return null;
		}
	}

	function setOptsImageParameters(layer, opts){
		if (layer.type === 'dynamic'){
			if (layer.imageformat !== undefined){
				var ip = new ImageParameters();
				ip.format = layer.imageformat;

				opts.imageParameters = ip;
			}
		}

		return opts;
	}

	function parseMode(xml){
		switch(xml){
			case "onDemand":
				return FeatureLayer.MODE_ONDEMAND;
			case "selection":
				return FeatureLayer.MODE_SELECTION;
			case "auto":
				return FeatureLayer.MODE_AUTO;
			case "snapshot":
				return FeatureLayer.MODE_SNAPSHOT;
			default:
				console.warn("Invalid mode detected: " + xml);
				return "";
		}
	}

	function generateInfoTemplates(sublayers){
		var infoTemplates = {};
		array.forEach(sublayers, function(sublayer){
			var popup = project.config.popups.get(sublayer.popupconfig);
			if (popup && popup.fields){

				// Make sure that dynamic fields have a $ in front
				var title = "&nbsp;";
				if (typeof popup.title === "string"){
					title = popup.title.replace("{", "${");
					title = title.replace("$$", "$");
				}

				infoTemplates[sublayer.id] = {
					infoTemplate: infoTemplate.create(title, popup.fields.field, {
						showAttachments: popup.showattachments,
						showRelatedRecords: popup.showrelatedrecords
					}),
					layerUrl: null
				};
			}
		});
		return infoTemplates;
	}

	// Instantiate layer objects from the project's configuration
	function getOperationalLayers(params){
		params = dojo.mixin({
			onError: function(err){},
			test: false
		}, params);

		var layers = [];

		array.forEach(project.config.map.operationallayers.layer, function(layer){

			// Do not include transparent layers, 
			// unless they are used for snapping
			if (layer.alpha !== undefined && layer.alpha === 0 && !layer.snapping) return;

			var opts = {
				opacity: layer.alpha !== undefined ? layer.alpha : 1,
				visible: layer.visible !== undefined ? layer.visible : false,
				id: layer.label,
				outFields: ["*"]
			};

			if (layer.mode && layer.type === "feature"){
				opts.mode = parseMode(layer.mode);
			}

			if (layer.displaylevels){
				if (layer.type === "tiled"){
					opts.displayLevels = layer.displaylevels
											.split(",")
											.map(function(n){
												return parseInt(n);
											});
				}else{
					console.warn("Tried to set display levels for a non-tiled layer: " + layer.label + ". Nothing will happen.");
				}
			}

			if (Object.prototype.toString.call(layer.sublayer) === "[object Object]") layer.sublayer = [layer.sublayer];
			if (layer.sublayer && layer.sublayer.length > 0){
				opts.infoTemplates = generateInfoTemplates(layer.sublayer);
			}
			
			if (layer.type === "feature" && layer.popupconfig !== undefined){
				opts.infoTemplate = generateInfoTemplates([{id: 999, popupconfig: layer.popupconfig}])[999].infoTemplate;
			}

			// Do not instantiate on test
			if (!params.test){
				opts = setOptsImageParameters(layer, opts);

				var instance = instantiateLayer(layer.type, layer.url, opts);
				instance.configType = layer.type; // Save config type
				on(instance, "error", params.onError);

				if (instance) {
					// Copy over snapping flag
					if (layer.snapping) instance.snapping = true;

					layers.push(instance);
					// console.log("Added " + layer.label);
				}
			}
		});

		return layers;
	}

	// Instantiate operational layers that are transparent
	// and that haven't been added to the map for rendering
	// but for which the legend is still desired.
	function getTransparentLegendOpLayers(){
		var layers = [];
		array.forEach(project.config.map.operationallayers.layer, function(layer){
			if (layer.alpha !== 0) return;

			// Only tiled and dynamic layers are supported for legend widget
			if (layer.type !== "dynamic" && layer.type !== "tiled") return;

			var opts = {
				opacity: 1, // Needed to show images in legend
				visible: layer.visible !== undefined ? layer.visible : false,
				id: layer.label,
				outFields: ["*"]
			};
			
			opts = setOptsImageParameters(layer, opts);
			var instance = instantiateLayer(layer.type, layer.url, opts);
			instance.configType = layer.type; // Save config type
			if (instance) layers.push(instance);
		});

		return layers;
	}

	function getOperationalLayersOrderMap(){
		var dict = {};
		var count = 0;
		array.forEach(project.config.map.operationallayers.layer, function(layer){
			dict[layer.label] = count++;
		});
		return dict;
	}

	function getBasemapLayerType(type, style){
		switch(type){
			case "osm":
				return "OpenStreetMap";
			case "webtiled":
				return "WebTiledLayer";
			case "tiled":
            case "image":
            case "dynamic":
				return undefined; // image corresponds to no need to specify type
			case "bing":
				return style && style.indexOf("aerial") !== -1 ? 
							"BingMapsAerial" : 
							"BingMapsHybrid";
			default:
				console.warn("Unknown basemap layer type: " + type);
				return undefined;
		}
	}

	function getBasemapLayers(){
		var layers = {};
		var count = 0;

		array.forEach(project.config.map.basemaps.getLayers(), function(basemap){
			if (basemap.label){
				var params = {
					type: getBasemapLayerType(basemap.type, basemap.style),
					url: basemap.url
				};

				if (basemap.displaylevels){
					params.displayLevels = basemap.displaylevels
											.split(",")
											.map(function(n){
												return parseInt(n);
											});
				}
				if (basemap.alpha) params.opacity = basemap.alpha;

				var thumbnail = basemap.icon;

				// Modify thumbnail path if necessary
				if (thumbnail){
					if (thumbnail.indexOf("assets") === 0){
						thumbnail = "/config/projects/" + project.config.name + "/" + thumbnail;
					}
				}

				// Aggregate together basemaps that share the same label
				var p = layers[basemap.label] || {
												id: "basemap_" + (65535 - count), // First basemap needs a higher id to show up first in sorting
												layers: [],
												title: basemap.label,
												thumbnailUrl: thumbnail
											};
				p.layers.push(new BasemapLayer(params));
				layers[basemap.label] = p;

				count++;
			}
		});

		var list = [];
		for (var i in layers) list.push(layers[i]);
		return list;
	}

	return {
		getOperationalLayers: getOperationalLayers,
		getOperationalLayersOrderMap: getOperationalLayersOrderMap,
		getBasemapLayers: getBasemapLayers,
		getTransparentLegendOpLayers: getTransparentLegendOpLayers,
		
		// Convert layer object into a structure valid
		// for use in the LayerControl widget
		layerToLayerInfo: function(layer){
			layer = layer.layer || layer;

			var name = layer.id || layer.name;
			return {
				layer: layer,
				title: typeof name === "string" ? 
						name.replace(/_/g, " ") : // Replace _ with spaces
						name,
				type: layer.configType,
				controlOptions: {
					metadataUrl: true,
					allSublayerToggles: false
				}
			};
		},

		// Retrieves the extent of a sublayer from the server
		// (feature not available in ESRI's API)
		// @param layer layer object (for example coming from map.getLayer())
		// @param sublayerInfo esri/layers/LayerInfo structure about the sublayer
		// @param targetSpatialReference esri/SpatialReference structure target spatial reference
		querySublayerExtent: function(layer, sublayerInfo, targetSpatialReference){
			var token = auth.getCurrentToken();
			var deferred = new Deferred();
			var self = this;

			if (layer.url && sublayerInfo.id){
				var url = layer.url + "/" + 
						  sublayerInfo.id + 
						  "?f=json&token=" + token;

				request.get(url, {
					handleAs: "json",
					// Avoid preflight request
					headers: {
						"X-Requested-With": null
					}
				}).then(function(json){
					if (json.extent){
						var extent = new Extent(json.extent);

						if (extent.spatialReference.wkid === targetSpatialReference.wkid){
							deferred.resolve(extent);
						}else{
							mapGeometries.reproject([extent], targetSpatialReference).then(function(r){
									deferred.resolve(r[0]);
								}, deferred.reject);
						}
					}else{
						deferred.reject("Invalid json returned for extent query.");
					}
				}, deferred.reject);
			}else{
				deferred.reject("Invalid params");
			}

			return deferred;
		}
	};
});