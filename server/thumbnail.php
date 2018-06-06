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
    require('config.php');
    
    if (!isset($_GET['u'])) die("Invalid image");
    $imageurl = $_GET['u'];

    // TODO: whitelist only certain domains
    // $allowed_domains = array(APP_URL);

    // $allowed = false;

    // foreach ($allowed_domains as $ad){
    //     // startsWith
    //     if (substr($imageurl, 0, strlen($ad)) === $ad){
    //         $allowed = true;
    //         break;
    //     }
    // }

    // if (!$allowed) die("Not allowed");

    $fp = fopen($imageurl, 'r');
    if (!(strpos($http_response_header[0], '200 OK') !== false)) die("Couldn't reach server");

    // Find extension by content type
    $extension = null;

    foreach($http_response_header as $header){
        $header = strtolower($header);
        switch ($header){
            case "content-type: image/jpeg":
            case "content-type: image/jpg":
            case "content-disposition: inline; filename=\"image.jpg\"":
                $extension = ".jpg";
                break;
            case "content-type: image/gif":
                $extension = ".gif";
                break;
            case "content-type: image/png":
                $extension = ".png";
                break;
        }
        if (preg_match('/content-disposition: inline; filename=".+\.(jpg|png|jpeg|gif)"$/', $header, $matches, PREG_UNMATCHED_AS_NULL)){
            $extension = "." . $matches[1];
        }

        if ($extension) break;
    }

    $width  = 200;
    $height = 150;
    
    // Content type not found, try to use URL extension...
    if (!$extension){
        $extension = strrchr($imageurl, '.');
        $extension = strtolower($extension);
    }
    if (in_array($extension, array(".jpg", ".jpeg", ".gif", ".png"))){
        list($width_orig, $height_orig) = getimagesize($imageurl);

        if ($width > $width_orig) $width = $width_orig;
        if ($height > $height_orig) $height = $height_orig;

        if ($width && $width_orig < $height_orig) {
            $width = ($height / $height_orig) * $width_orig;
        } else {
            $height = ($width / $width_orig) * $height_orig;
        }   

        $image_out = imagecreatetruecolor($width, $height);
    }else{
        die("Invalid type");
    }

    if(in_array($extension, array(".jpg", ".jpeg"))){
        header('Content-type: image/jpeg');
        $image = imagecreatefromjpeg($imageurl);
    }else if($extension == ".gif") {
        header('Content-type: image/gif');
        $image = imagecreatefromgif($imageurl);
    }else if($extension == ".png") {
        header('Content-Type: image/png');
        $image = imagecreatefrompng($imageurl);
    }

    imagefill($image_out,0,0,imagecolorallocate($image_out, 255, 255, 255));
    imagesavealpha($image_out, true);
    imagecopyresampled($image_out, $image, 0, 0, 0, 0, $width, $height, $width_orig, $height_orig);
    imagejpeg($image_out, null, 83);
?>