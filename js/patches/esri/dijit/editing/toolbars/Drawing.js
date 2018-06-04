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
define(["esri/dijit/editing/toolbars/Drawing",
    "dojo/topic", "maple/helpers/utils"],
    function(Drawing, topic, utils){
        "use strict";

        utils.intercept(Drawing, '_toolFinished', function(original, args){
            // If a popup has been closed, we need to make sure 
            // we can open it with the attributes button
            // no matter what.
            if (args[0] === "ATTRIBUTES"){
                topic.publish("popup/dontPreventShow");
                setTimeout(original, 300); // give time for publish to propagate
            }else{
                original();
            }
        });
    }
);