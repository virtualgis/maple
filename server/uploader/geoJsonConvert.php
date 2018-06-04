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
ini_set('memory_limit','512M');
ob_start("ob_gzhandler");

require(dirname(__FILE__) . '/include/Uploader.php');
require(dirname(__FILE__) . '../config.php');

$csvProjection = 4326;
if (isset($_GET['csvProjection']) && is_numeric($_GET['csvProjection'])){
	$csvProjection = escapeshellarg(intval($_GET['csvProjection']));
}

define('OGR2OGR_SHAPEFILE', 'ogr2ogr -f GeoJSON -t_srs EPSG:4326');
define('OGR2OGR_CSV', 'ogr2ogr -s_srs EPSG:' . $csvProjection . ' -t_srs EPSG:4326 -f GeoJSON -oo X_POSSIBLE_NAMES="East*,Lon*,X" -oo Y_POSSIBLE_NAMES="North*,Lat*,Y" -oo KEEP_GEOM_COLUMNS=NO');
define('NODE_TOGEOJSON', "node ../../tools/togeojson/togeojsoncli");

header('Content-Type: application/json');

ini_set('display_errors', '0');

function deleteDir($dirPath) {
    if (! is_dir($dirPath)) {
        throw new InvalidArgumentException("$dirPath must be a directory");
    }
    if (substr($dirPath, strlen($dirPath) - 1, 1) != '/') {
        $dirPath .= '/';
    }
    $files = glob($dirPath . '*', GLOB_MARK);
    foreach ($files as $file) {
        if (is_dir($file)) {
            deleteDir($file);
        } else {
        	$sleep = 100;
        	$limit = 0;
            while (unlink($file) === FALSE){
            	usleep($sleep);
            	$sleep *= 2;

            	if ($limit++ > 100) break;
            }
        }
    }
    rmdir($dirPath);
}

function findFirst($dir, $pattern){
	foreach (glob($dir . "/" . $pattern) as $filename) {
	    return $filename;
	}
}

function cleanup(){
	global $upload_dir;
	deleteDir($upload_dir);
}

function exitFailure($msg){
  cleanup();
  exit(json_encode(array('success' => false, 'msg' => $msg))); 
}
// Handle file
$uploader = new FileUpload('uploadfile');

$now = time();
$unow = microtime();
$uuid = sha1($uploader->getFileName() . $unow . mt_rand() . SECRET);
$temp_dir = '../../tmp/';
$upload_dir = $temp_dir . $uuid;

if (!file_exists($upload_dir)){
	mkdir($upload_dir);
}



// Handle the upload
$result = $uploader->handleUpload($upload_dir, array("kml", "kmz", "zip", "csv", "json"));

if (!$result) {
  exitFailure($uploader->getErrorMsg());  
}

$filePath = $uploader->getSavedFile();
$ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

$fileType = "unknown";
switch($ext){
	case "zip":
		$fileType = "shapefile";
		break;
	case "kml":
	case "kmz":
		$fileType = "googleEarth";
		break;
	case "csv":
		$fileType = "csv";
		break;
	case "json":
		$fileType = "geoJson";
		break;
}
if ($fileType == "unknown") exitFailure("Unknown file type");

if ($ext == 'zip' || $ext == 'kmz'){
	$zip = new ZipArchive;
	$handle = $zip->open($filePath);
	if ($handle === TRUE) {
	  $zip->extractTo($upload_dir);
	  $zip->close();
	} else {
	  exitFailure("Could not extract .zip file");
	}
}

$geojson = "{}";

$output = array();
$return_code = -1;
$ouput_file = $upload_dir . "/output.json";
$input_file = "";

if ($fileType == "shapefile"){
	$input_file = findFirst($upload_dir, "*.shp");
}else if ($fileType == "googleEarth"){
	if ($ext == "kmz"){
		$input_file = findFirst($upload_dir, "*.kml");
	}else{
		$input_file = $filePath;
	}
}else if ($fileType == "csv" || $fileType == "geoJson"){
	$input_file = $filePath;
}

if ($fileType == "shapefile" || $fileType == "geoJson"){ 
	// geoJson doesn't need any conversion, but we use the same command as shapefile to guarantee that our output is in UTF8 (see requirements of json_encode)
	exec(OGR2OGR_SHAPEFILE . " " . escapeshellarg($ouput_file) . " " . escapeshellarg($input_file) . " 2>&1", $output, $return_code);
}else if ($fileType == "csv"){
	exec(OGR2OGR_CSV . " " . escapeshellarg($ouput_file) . " " . escapeshellarg($input_file) . " 2>&1", $output, $return_code);
}else if ($fileType == "googleEarth"){
	exec(NODE_TOGEOJSON . " " . escapeshellarg($input_file) . " > " . escapeshellarg($ouput_file)  . " 2>&1", $output, $return_code);
}

if ($return_code !== 0){
	exitFailure($output[0]);
	// exitFailure("Cannot convert to GeoJSON");
}

if (file_exists($ouput_file)){
	$geojson = json_decode(file_get_contents($ouput_file));
	if ($geojson == ""){
		exitFailure("Conversion to GeoJSON failed");
	}
}else{
	exitFailure("Cannot find GeoJSON output");
}

echo json_encode(array('success' => true, 'geojson' => $geojson));
cleanup();
