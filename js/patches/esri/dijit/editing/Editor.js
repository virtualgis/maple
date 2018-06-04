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
define(["esri/dijit/editing/Editor", "dojo/has", 
    "dojo/topic", "maple/helpers/utils"],
    function(Editor, has, topic, utils){
        "use strict";

        var preventPopupShow = false;

        // If the user has closed the popup once,
        // don't reopen it unless he clears the selection
        // This prevents the popup from showing it during 
        // shape editing
        topic.subscribe("popup/hide", function(){
            preventPopupShow = true;
        });

        topic.subscribe("popup/dontPreventShow", function(){
            preventPopupShow = false;
        });

        utils.intercept(Editor, '_clearSelection', function(original){
            original();
            preventPopupShow = false;
        });

        utils.intercept(Editor, '_showInfoWindow', function(original){
            if (!preventPopupShow){
                original();
            }
        });
    }
);