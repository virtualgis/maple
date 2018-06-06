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

ini_set("error_reporting", E_ALL & ~E_DEPRECATED);

require 'config.php';
require 'vendor/autoload.php';

if (!defined('ARCGIS_WEBADAPTOR_ADMIN_URL')) die("Not enabled. Check your config.php");

use GuzzleHttp\Client;
use Flintstone\Flintstone;
use Flintstone\Formatter\JsonFormatter;

header("Access-Control-Allow-Origin: *");
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept');
header('Content-Type: application/json');

// Init
$options = array('dir' => DB_DIR, 'formatter' => new JsonFormatter());
$tokens = Flintstone::load('tokens', $options);
$client = new Client([
    'base_uri' => ARCGIS_WEBADAPTOR_ADMIN_URL
]);

// Begin
function exitFailure($msg){
  exit(json_encode(array('success' => false, 'msg' => $msg))); 
}
function exitFakeFailure($msg){
  if ($_POST['username'] != ""){
   $chars = str_split($_POST['username']);
   $seed = 0;
   for($i = 0; $i < count($chars); $i++){
   	 $seed += ord($chars[$i]);
   }
   srand($seed);
  }
  $emailDomain = rand(0, 3) == 1 ? "yahoo.com" : "gmail.com";
  usleep(rand(0, 4000000));

  exit(json_encode(array('success' => true, 'msg' => "Success", 'emailDomain' => $emailDomain))); 
}

function getAdminToken(){
	global $tokens;
	global $client;

	if (!$tokens->get('admin_token')){
		$tokens->set('admin_token', array("token" => "", "expires" => 0));
	}

	$adminTokenInfo = $tokens->get('admin_token');
	if (time() * 1000 >= (int)($adminTokenInfo['expires']) - 60000){ // Expire it 1 minute prior to actual expiration
		try{
			$response = $client->request('POST', 'generateToken', [
					'form_params' => [
						'f' => 'json',
						'client' => 'requestip',
						'username' => ARCGIS_ADMIN_USER,
						'password' => ARCGIS_ADMIN_PASS,
						'expiration' => 60 // 1 hour,
					]
				]);
			$result = json_decode((string) $response->getBody());
			if (isset($result->token)){
				$tokens->set('admin_token', array("token" => $result->token, "expires" => $result->expires));			
			}else{
				return "";
			}
		}catch(Exception $e){
			exitFailure($e->getMessage());
		}
	}

	return $tokens->get("admin_token")["token"];
}

function retrieveUserInfo($adminToken, $username){
	global $client;

	try{
		$response = $client->request('POST', 'security/users/search', [
				'form_params' => [
					'filter' => $username,
					'maxCount' => 1,
					'f' => 'json',
					'token' => $adminToken
				]
			]);
		$result = json_decode((string) $response->getBody());
		if (isset($result->users) && count($result->users) > 0){
			$userInfo = null;
			for ($i = 0; $i < count($result->users); $i++){
				if (strtolower($result->users[$i]->username) == $username){
					$userInfo = $result->users[$i];
					break;
				}
			}
			if ($userInfo != null){
				return $userInfo;
			}else{
				exitFakeFailure("Could not find user (from array) " . $username);
			}
		}else{
			exitFakeFailure("Could not find user " . $username);
		}
	}catch(Exception $e){
		exitFailure($e->getMessage());
	}
}

function changeUserPassword($adminToken, $username, $newPassword){
	global $client;

	try{
		$response = $client->request('POST', 'security/users/update', [
				'form_params' => [
					'username' => $username,
					'password' => $newPassword,
					'f' => 'json',
					'token' => $adminToken
				]
			]);
		$result = json_decode((string) $response->getBody());
		if (isset($result->status) && $result->status == 'success'){
			sendAdminNotifications($username);

			return true;
		}else{
			exitFailure("Could not change password for " . $username);
		}
	}catch(Exception $e){
		exitFailure($e->getMessage());
	}
}

function sendAdminNotifications($username){
	if (isset($_POST['projectName'])){
		$anl = getAdminNotificationList();
		$projetName = $_POST['projectName']; // No need to purify

		if (isset($anl[$projetName])){ // Only allowed values will pass
			$notifyEmails = $anl[$projetName];

			foreach($notifyEmails as $email){
				sendMail($email, $email, $projetName . " Notification (Pass Reset)", 
					"views/admin_user_pass_reset_notification.html", 
					array(
							"name" => $username,
							"project" => $projetName
						)
					);
			}
		}
	}
}


function renderTemplate($template_file, $values){
	$info = pathinfo ($template_file);

	$engine = new Scurvy($info["basename"], $info["dirname"] . "/");
	foreach($values as $key => $value){
		$engine->set($key, $value);
	}

	return $engine->render();
}

function getIp(){
	$ret = "IP " . $_SERVER['REMOTE_ADDR'];
	if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) $ret .= " (Proxy Forwarded For IP: " . $_SERVER['HTTP_X_FORWARDED_FOR'] . ")";
	return $ret;
}

function crypto_rand_secure($min, $max) {
        $range = $max - $min;
        if ($range < 0) return $min; // not so random...
        $log = log($range, 2);
        $bytes = (int) ($log / 8) + 1; // length in bytes
        $bits = (int) $log + 1; // length in bits
        $filter = (int) (1 << $bits) - 1; // set all lower bits to 1
        do {
            $rnd = hexdec(bin2hex(openssl_random_pseudo_bytes($bytes)));
            $rnd = $rnd & $filter; // discard irrelevant bits
        } while ($rnd >= $range);
        return $min + $rnd;
}

function generateNonce($length=32){
    $token = "";
    $codeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    $codeAlphabet.= "abcdefghijklmnopqrstuvwxyz";
    $codeAlphabet.= "0123456789";
    for($i=0;$i<$length;$i++){
        $token .= $codeAlphabet[crypto_rand_secure(0,strlen($codeAlphabet))];
    }
    return array("token" => $token, "expires" => (time() + 2*60*60)); // 2 hours
}

function sendMail($to_addr, $to_name, $subject, $template, $values){
	$mail = new PHPMailer;

	//$mail->SMTPDebug = 3;                               // Enable verbose debug output

	$mail->isSMTP();                                      // Set mailer to use SMTP
	$mail->Host = SMTP_HOST;  // Specify main and backup SMTP servers
	$mail->SMTPAuth = true;                               // Enable SMTP authentication
	$mail->Username = SMTP_USER;                 // SMTP username
	$mail->Password = SMTP_PASS;                           // SMTP password
	$mail->SMTPSecure = SMTP_SECURITY;                            // Enable TLS encryption, `ssl` also accepted
	$mail->Port = SMTP_PORT;                                    // TCP port to connect to

	$mail->setFrom(MAIL_FROM_ADDR, MAIL_FROM);
	if ($to_name){
		$mail->addAddress($to_addr, $to_name); 
	}else{
		$mail->addAddress($to_addr);
	}
	$mail->isHTML(true);                                  // Set email format to HTML

	$mail->Subject = $subject;
	$mail->Body    = renderTemplate($template, $values);
	$mail->AltBody = strip_tags($mail->Body);

	if($mail->send()) {
		return true;
	}else{
		exitFailure("Could not send reset e-mail. " . $mail->ErrorInfo);
	}
}

// Run

$adminToken = getAdminToken();
if ($adminToken != ""){

	// Request token via e-mail
	if (isset($_POST['username']) && isset($_POST['project'])){
		$user = strtolower($_POST['username']);
		$project = $_POST['project'];

		$userInfo = retrieveUserInfo($adminToken, $user);
		if (!$userInfo->disabled){
			if ($userInfo->email != ''){
				// Generate token stuff
				$nonce = generateNonce();
				$tokens->set($nonce['token'], array("expires" => $nonce['expires'], "user" => $user));
				$reset_link = APP_URL . "?p=$project&token=$nonce[token]&expires=$nonce[expires]#app,resetpwd";

				// Send email
				if (sendMail($userInfo->email, $userInfo->fullname, "Password Reset", 
					"views/reset_password_email.html", 
					array("name" => $userInfo->fullname ? $userInfo->fullname : $userInfo->username,
						"ip" => getIp(),
						"appDomain" => APP_DOMAIN,
						"resetUrl" => $reset_link)
					)){

					// Extract domain of the email
					$emailDomain = preg_replace("/.+@(.+)$/", "\\1", $userInfo->email);
					echo json_encode(array('success' => true, 'msg' => "Success", 'emailDomain' => $emailDomain));
				}else{
					// Nothing
				}
			}else{
				exitFailure("User does not have an e-mail address.");
			}
		}else{
			exitFakeFailure("User is disabled.");
		}

	// Set new password
	}else if (isset($_POST['token']) && isset($_POST['newPassword'])){
		$token = $_POST['token'];
		$newPassword = $_POST['newPassword'];
		if (strlen($newPassword) < 7){
			exitFailure("Password must be longer than 7 characters.");
		}
		if (strlen($newPassword) >= 50){
			exitFailure("Password must be shorter than 50 characters.");
		}

		// Validate token
		$storedTokenInfo = $tokens->get($token);
		if ($storedTokenInfo){

			// Check expiration
			if (time() < $storedTokenInfo['expires']){

				// All good, request looks legit
				$username = $storedTokenInfo['user'];

				if (changeUserPassword($adminToken, $username, $newPassword)){
					// Remove token
					$tokens->delete($token);

					echo json_encode(array('success' => true, 'msg' => "Success"));
				}else{
					// Nothing, exitFailure is called in changeUserPassword
				}
			}else{
				// Remove token
				$tokens->delete($token);

				exitFailure("Token has expired. Please fill the form to reset your password again.");
			}
		}else{
			exitFailure("Invalid token.");
		}
	}
}else{
	exitFailure("Cannot retrieve admin token.");
}

?>