<?php
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


define('APP_URL', 'http://localhost');
define('SECRET', 'CHANGEME!!!');

// If your users login using the user store
// and you allow password resets, uncomment 
// the lines below

// define('DB_DIR', dirname( dirname(__FILE__) ) . '/db/');
// define('ARCGIS_ADMIN_USER', 'changeme');
// define('ARCGIS_ADMIN_PASS', 'changeme');
// define('ARCGIS_WEBADAPTOR_ADMIN_URL', 'http://localhost/arcgiswebadaptor/admin/');

// define('SMTP_HOST', 'mail.change.me');
// define('SMTP_USER', 'support');
// define('SMTP_PASS', 'password');
// define('SMTP_PORT', 465);
// define('SMTP_SECURITY', 'ssl');
// define('MAIL_FROM', 'Maple Support');
// define('MAIL_FROM_ADDR', 'support@change.me');

function getAdminNotificationList(){
	return array(
				// project name --> list of notifications e-mails
				"default" => array("email1@domain.com"),
			);
}

?>