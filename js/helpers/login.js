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
define(["maple/config/project", "maple/helpers/utils"], 
	function(project, utils){
	"use strict";
		return {
			needToShowPostLoginMessage: function(){
				var postLoginMessage = project.config.postLoginMessage;
				if (postLoginMessage){
					if (postLoginMessage.frequency === "oneTime" && localStorage){
						var hashCode = utils.hashCode(postLoginMessage.message);
						if (localStorage.getItem("shownPostLoginMessage_" + project.config.loadedConfiguration + "_" + hashCode)){
							return false;
						}else{
							// we will call localStorage.setItem in postLoginMessage.js
							return true;
						}
					}else{
						return true;
					}
				}else{
					return false;
				}
			},

			reloadNewConfiguration: function(jsonConfigFile){
				var self = this;

				// We load the new configuration to check for post login messages
				// then we refresh the whole page to save the jsonConfigFile parameter
				// in case the user later refreshes the page (F5).

				function reloadAppTo(targetState){
					location.href = "/?p=" + project.config.name + "&c=" + jsonConfigFile.replace(".json", "") + "#" + targetState;
				}

				project.loadProfile(jsonConfigFile, function(){
					var targetState = self.needToShowPostLoginMessage() ? "app,postloginmessage" : "app,map";
					reloadAppTo(targetState);
				}, function(){
					// on error we simply reload (without caring about targetState)
					reloadAppTo("app,map");
				});
			}
		};
	}	
);