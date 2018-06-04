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
define(["dojo/on", "dojo/has!touch?esri/dijit/PopupMobile:esri/dijit/Popup", "dojo/has"], 
	function(on, Popup, has){
	"use strict";

	return {
		get: function(){
			var popup = new Popup(null, dojo.create("div"));

			// remove hard coded img references in the MobilePopup
			// Mm, yeah, no other way to replace default images :/
			// This is actually used in ESRI's official docs
			
			// Bonus problem: simply removing the src attribute will 
			// leave a gray border, so we need to place something transparent
			var smallTransparentImg = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
	        
	        on(popup, "show", function (){
	        	dojo.query(".esriMobileNavigationItem.left > img[src]").attr('src', smallTransparentImg);
	        	dojo.query(".esriMobileNavigationItem.right > img[src]").attr('src', smallTransparentImg);
	        });
	        on(popup, "selection-change", function (){
        		dojo.query(".esriMobileNavigationItem.right1 > img[src]").attr('src', smallTransparentImg);
	        	dojo.query(".esriMobileNavigationItem.right2 > img[src]").attr('src', smallTransparentImg);
	        });

	        // Add missing _setPagerCallbacks method to the mobile popup
	        // so that we can use the Editor widget properly. 
	        // ESRI...
	        if (!popup._setPagerCallbacks) popup._setPagerCallbacks = function(){};

			return popup;
		},

		// Helper to show a popup on the map
		// @param opts {
		// 		map: map reference
		// 		point: location of the popup
		// 		title: string or function returning the title
		// 		content: string or function returning the content
		// 		mobileTitle (optional): string or function returning the title on mobile
		// 		mobileContent (optional): string or function returning the content on mobile
		// 		hideZoom (optional): whether to hide the zoom button
		// } 
		show: function(opts){
			function toFunction(input){
				if (typeof input === "function"){
					return input;
				}else{
					return function(){
						return input;
					};
				}
			}

			opts.map.infoWindow.show(opts.point, opts.map.getInfoWindowAnchor(opts.point), {hideZoom: opts.hideZoom !== undefined ? opts.hideZoom : false});
			
			if (has("touch")){
				opts.map.infoWindow.selectedIndex = 0;
				opts.map.infoWindow.features = [{
					getContent: opts.mobileContent !== undefined ? toFunction(opts.mobileContent) : toFunction(opts.content),
					getTitle: opts.mobileTitle !== undefined ? toFunction(opts.mobileTitle) : toFunction(opts.title)
				}];
				opts.map.infoWindow.setFeatures();
			}else{
				opts.map.infoWindow.setTitle((toFunction(opts.title))());
				opts.map.infoWindow.setContent((toFunction(opts.content))());
			}
		}
	};
});