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
define(["dojo/dom", "dojo/dom-class",
		 "maple/config/project",
		 "maple/helpers/utils",
		 "dijit/registry",
		 "dojox/mobile/TransitionEvent",
		 "maple/helpers/WheelScrollableView"
	], function(dom, domClass,
				project, utils,
				registry,
				TransitionEvent){
		"use strict";
		var standBy;

		return {
			title: project.get("config.postLoginMessage.title", ""),
			continueButtonLabel: project.get("config.postLoginMessage.continueButtonLabel", "Continue"),

			init: function(){
				standBy = registry.byId("loginStandby");
			},

			beforeActivate: function(){
				this.message.innerHTML = project.get("config.postLoginMessage.message", "This is a message to be shown after login.");
			},

			afterActivate: function(){
				standBy.hide();
			},

			afterDeactivate: function(){
				standBy.hide();
			},

			btnContinuePressed: function(e){
				if (localStorage){
					var hashCode = utils.hashCode(this.message.innerHTML);
					localStorage.setItem("shownPostLoginMessage_" + project.config.loadedConfiguration + "_" + hashCode, "1");
				}
				standBy.show();
				new TransitionEvent(e.target, {
	    			target: "app,map",
	    			transition: "slide",
	    			transitionDir: 1
	    		}).dispatch();
			}
		};
	}
);