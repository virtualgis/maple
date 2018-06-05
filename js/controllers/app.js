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
define(["dojo/has", "dojo/dom-class", "esri/config", 
	"maple/config/project", "maple/helpers/auth",
	"maple/helpers/utils", "maple/config/server",
	"esri/tasks/GeometryService",
	"jquery",
	"maple/patches/esri/dijit/Popup",
	"maple/patches/esri/dijit/PopupMobile",
	"maple/patches/esri/dijit/Legend",
	"maple/patches/esri/dijit/editing/Editor",
	"maple/patches/esri/dijit/editing/AttachmentEditor",
	"maple/patches/esri/dijit/editing/AttributeInspector",
	"maple/patches/esri/dijit/editing/tools/Selection",
	"maple/patches/esri/dijit/editing/toolbars/Drawing"],
	function(has, domClass, esriConfig, project, auth, utils, server, GeometryService, $){
		"use strict";

		esriConfig.defaults.map.panDuration = 1; // time in milliseconds, default panDuration: 250
		esriConfig.defaults.map.panRate = 1; // default panRate: 25
		esriConfig.defaults.map.zoomDuration = 250; // default zoomDuration: 500
		esriConfig.defaults.map.zoomRate = 1; // default zoomRate: 25
		if (server.urls){
			esriConfig.defaults.geometryService = new GeometryService(server.urls.geometryService);
			esriConfig.defaults.kmlService = server.urls.kmlService;
		}

		// Make sure timeouts are set or all XHR requests, not just
		// those made with esri/request
		var oldXhr = dojo.xhr;
		dojo.xhr = function(method, options){
			var opts = options || {};
			opts.timeout = esriConfig.defaults.io.timeout;
			return oldXhr(method, opts);
		};

		return {
			init: function(){
				document.body.className += ' loaded';

				if (has("touch")) domClass.add(document.documentElement, "touch");
				domClass.add(document.documentElement, "auth-" + project.config.server.authentication);
				
				console.log("Name: " + project.config.title);
				console.log("App Init Completed");

				document.title = project.config.title;

				auth.initialize(project);
			}
		};
	}
);