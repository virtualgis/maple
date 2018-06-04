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
define(["esri/dijit/editing/AttachmentEditor", 
	"maple/helpers/utils", "jquery"], 
	function(AttachmentEditor, utils, $) {
		"use strict";

		// Add the ability to enable/disable the zoom button
		// when showing a popup (desktop only)
		utils.intercept(AttachmentEditor, 'startup', function(original){
			original();

			// dojoClick screws up uploads on mobile so we turn it off
			this._uploadField.dojoClick = false;
		});

		// Strip off leading and trailing parentheses
		AttachmentEditor.prototype._deleteBtnHtml = AttachmentEditor.prototype
			._deleteBtnHtml
			.replace(/^\(/, "")
			.replace(/\)$/, "");

		// Prompt for confirmation on deletion of attachments
		utils.intercept(AttachmentEditor, '_deleteAttachment', function(original){
			if (window.confirm("Are you sure you want to delete this attachment?")){
				original();
			}
		});

		// Show thumbnails
		utils.intercept(AttachmentEditor, ['_onQueryAttachmentInfosComplete', '_onAddAttachmentComplete'], function(original){
			original();
			$(this._attachmentList).children().each(function(){
				var $attachmentLink = $(this).children("a"),
					filename = $attachmentLink.text(),
					imageUrl = $attachmentLink.attr('href');

				if (/\.(jpg|jpeg|png|gif)$/i.test(filename)){
					// Thumbnail!
					var thumbUrl = "/server/thumbnail.php?u=" + imageUrl;
					
					// Set loading
					var $image = $('<img class="thumbnail" src="/images/spinner.gif" title="' +  filename + '"/>'),
						$content = $('<div class="thumbnailContainer"></div>');
					$content.append($image);
					$content.append('<div class="filename">' + filename + '</div>');

					$attachmentLink.html($content);

					// Load image
					var img = new Image();
					img.onload = function(){
						$image.attr('src', img.src);
					};
					img.src = thumbUrl;
				}
			});
		});

	}
);
