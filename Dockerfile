FROM php:7.2-apache

RUN apt update && apt install -y gdal-bin

COPY . /var/www/html/

VOLUME ["/var/www/html/config/projects"]
