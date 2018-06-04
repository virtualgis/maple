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
define(["esri/dijit/Popup", "maple/helpers/utils", 
	"dojo/topic", "dojo/query", "dojo/NodeList-dom"], 
	function(Popup, utils, topic, query) {
		"use strict";

		// Add the ability to enable/disable the zoom button
		// when showing a popup (desktop only)
	    utils.intercept(Popup, "show", function(original, args){
	    	original();

	    	var options = args[2],
	    		zoomTo = query(".action.zoomTo", this.domNode);
	    	if (zoomTo){
		    	if (options && options.hideZoom){
		    		zoomTo.addClass("hide");
		    	}else{
		    		zoomTo.removeClass("hide");
		    	}
	    	}
	    });

	    // Emit an event when the popup closes
	    utils.intercept(Popup, "hide", function(original){
	    	if (this.isShowing){
	    		topic.publish("popup/hide");
	    	}
	    	original();
	    });
	}
);