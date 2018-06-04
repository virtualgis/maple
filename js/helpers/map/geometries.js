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
define(["dojo/_base/lang",
		"dojo/Deferred",
	    "esri/config",
    	"esri/tasks/ProjectParameters"], 
	function(lang, Deferred, esriConfig, ProjectParameters){
	"use strict";

	return {
		reproject: function(geometries, targetSpatialReference){
			var deferred = new Deferred();

			// Need to reproject
			if (esriConfig.defaults.geometryService) {
                esriConfig.defaults.geometryService.project(lang.mixin(new ProjectParameters(), {
                    geometries: geometries,
                    outSR: targetSpatialReference
                }), function (r) {
                    deferred.resolve(r);
                }, function (e) {
                    deferred.reject("Could not project geometry");
                });
            }else{
            	deferred.reject("No geometryservice is set");
            }

			return deferred;
		}
	};
});