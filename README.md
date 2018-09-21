![maple](https://user-images.githubusercontent.com/1951843/40381155-f9f21e80-5dc8-11e8-86c0-b8deb595917d.png)

A modern, free and open-source web mapping application with built-in migration support for legacy Flex Viewer applications.

![Screenshot](https://user-images.githubusercontent.com/1951843/41064311-31dfb5fa-69a9-11e8-9074-c5f4b93e8040.png)

In June 2016 Viewer for Flex was [discontinued](https://community.esri.com/groups/technical-support/blog/2014/11/10/final-release-and-support-plan-for-the-arcgis-apis-viewers-for-flex-and-silverlight) with no clear migration path for existing applications. Maple was born out of the necessity to provide such migration path. Our goals have been to:

 - Allow an organization to continue using Viewer for Flex while the issues of a new application development are sorted out.
 - Keep configurations between the legacy application and the new application in sync, allowing for a transition period in which both applications can be available to users.

As a result of such goals, the configuration files in Maple have a 1-to-1 correspondence to those of legacy Flex applications.

![maple-diagram](https://user-images.githubusercontent.com/1951843/41065327-55b2e012-69ac-11e8-977f-41f81feb73e6.png)

We are planning to release the tool that automates the migration of legacy configuration files, but use of the tool is not required. Users can choose to port the configurations manually by using one of the many [XML to JSON converters](http://www.utilities-online.info/xmltojson/).

## Demo

* [Hello United States](https://maple.virtualgis.io/). A simple public map showcasing LayerList, eMapSwitcher and Bookmark widgets.
* [Construction Demo](https://maple.virtualgis.io/?p=superiordemo). A more complex configuration featuring user-based authentication (via the built-in user store) and showcasing LayerList, Legend, eMapSwitcher, Bookmark, Search, Locate, ElevationProfile, WMSLooping, Print, Query, ImportDataFile, Link, Measure, eDraw widgets.

## Getting Started

1. Install and configure a web server of your choice (Windows users can use [XAMP](https://www.apachefriends.org/index.html), which also installs PHP).
2. Install and configure PHP.
3. Download the [latest version](https://github.com/virtualgis/maple/archive/master.zip) of Maple and extract it in the root folder of your web server.
4. Go to http://localhost to make sure the default application loads.
5. Change the configuration files in `config/projects/default` for your application (documentation coming soon).

## Getting Started wih Docker

If you have [Docker](https://www.docker.com) you can simply run:

```bash
docker run -d -p 80:80 -v path/to/your/config:/var/www/html/config/projects/default virtualgis/maple
```

Then open a web browser to http://localhost.

## Creating Configuration Files

Currently looking at the existing configuration examples in `config/projects` is the easiest way to learn how to write configuration files for Maple.

A tool that automatically migrates configuration files coming from a legacy Flex Viewer application will also be available soon, so that you don't have to do it by hand.

## Supported Widgets

We currently support the following widgets:
- [X] Search
- [X] Query
- [X] Bookmark
- [X] eTime
- [X] WMSLooping
- [X] Legend
- [X] Link
- [X] Routes
- [X] Locate
- [X] ImportDataFile
- [X] Edit
- [X] LayerList
- [X] eMapSwitcher
- [X] Measure
- [X] eDraw
- [X] ElevationProfile
- [X] Print
- [X] ConfigSelectSplash (Maple has support for multiple profiles)

If you don't see one that you need in this list, open an [issue](https://github.com/virtualgis/maple/issues/new) to request it.

## Documentation

Coming soon

## Support the Project

There are many ways to contribute back to the project:

 - Help us test new and existing features and report [bugs](https://www.github.com/virtualgis/maple/issues) and [feedback](https://gitter.im/virtualgis/maple).
 - ⭐️ us on GitHub.
 - Spread the word about Maple on social media.
 - While we don't accept donations, you can purchase a [premium support contract](mailto:info@virtualgis.io).
 - Become a contributor.
 
 ## Contributing

The easiest way to get started is to take a look at our list of outstanding issues and pick one. You can also fix/improve something entirely new based on your experience with Maple. All ideas are considered and people of all skill levels are welcome to contribute.

You don't necessarily need to be a developer to become a contributor. We can use your help to write better documentation and improve the user interface texts and visuals.

If you know how to code, we primarily use Javascript (Dojo/jQuery), PHP, HTML and SCSS.

If you have questions come to [Gitter](https://gitter.im/virtualgis/maple) and we'll be happy to help you out with your first contribution.

## License

The reason for selecting the [AGPL v3.0](https://github.com/virtualgis/maple/blob/master/LICENSE) as our open source license is to require that enhancements to Maple be released to the community. Traditional GPL often does not achieve this anymore as a huge amount of software runs in the cloud.

If use of the AGPL v3 does not satisfy your organization’s legal department (some will not approve GPL in any form), commercial licenses are available. Feel free to [contact us](mailto:info@virtualgis.io) for more details.

## Roadmap

- [X] Basemap, Layer List, Measure Tool, Draw Tool (etc.) widgets
- [X] Icons
- [ ] Documentation
- [ ] Tools for Flex Viewer migration
- [X] CLA, Code of Conduct, Contributing Guidelines, etc.
- [ ] Unit Testing
- [ ] ES6 support
- [ ] Upgrade ESRI API to version 4
- [X] ESRI Online Support
- [X] ArcGIS Server Support

## Credits

Some icons have been modified from [IcoMoon - Free](https://icomoon.io/#icons-icomoon) CC BY 4.0.
