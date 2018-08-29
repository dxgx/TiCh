#!/usr/bin/env node

var program = require('commander'),
    chalk = require('chalk'),
    updateNotifier = require('update-notifier'),
    fs = require('fs'),
    tiappxml = require('tiapp.xml'),
    pkg = require('../package.json'),
    xpath = require('xpath'),
    _ = require('lodash');

tich();

function copyFile(fromPath, toPath) {
    fs.readFileSync(fromPath, function(err, data) {
        fs.writeFileSync(toPath, data);
    });
}

// main function
function tich() {

	// status command, shows the current config
	function status() {
		console.log('\n');
		console.log('Name: ' + chalk.cyan(tiapp.name));
		console.log('AppId: ' + chalk.cyan(tiapp.id));
		console.log('Version: ' + chalk.cyan(tiapp.version));
		console.log('GUID: ' + chalk.cyan(tiapp.guid));
		console.log('\n');
	}

	// select a new config by name
	function select(name, outfilename) {
		var regex = /\$tiapp\.(.*)\$/,
			regexProperty = /\$tiappProperty\.([^\{\}]*)\$/gm;

		if (!name) {

				var alloyCfg = readAppConfig();

				if (!alloyCfg) {
				    return;
			    }

				if (alloyCfg.global.theme) {
					console.log('\nFound a theme in config.json, trying ' + chalk.cyan(alloyCfg.global.theme));
					select(alloyCfg.global.theme);
				}
				else {
					status();
				}

		}
		else {
			// find the config name specified
			cfg.configs.forEach(function (config) {

				if (config.name === name) {

					console.log('\nFound a config for ' + chalk.cyan(config.name) + '\n');

					var alloyCfg = readAppConfig();

					if (!alloyCfg) {
					    return;
                    }

                    if (alloyCfg.global.theme) {

                        var original = alloyCfg.global.theme;

                        if (processAlloy) {

                            alloyCfg.global.theme = config.theme ? config.theme : config.name;
                            fs.writeFileSync('./app/config.json', JSON.stringify(alloyCfg, null, 2), function (err) {
                                if (err) return console.log(err);
                                console.log('\nChanging theme value in config.json from ' + chalk.cyan(original) + ' to ' + chalk.cyan(alloyCfg.global.theme));
                            });
                        }
                    }


					// settings without properties and raw
					for (var setting in config.settings) {

						if (!config.settings.hasOwnProperty(setting)) {
							continue;
						}

						if (setting !== 'properties' && setting !== 'raw') {

							var replaceWith = config.settings[setting];

							replaceWith = replacePlaceholders(replaceWith);

							if (typeof replaceWith === 'string') {

								var matchResult;

								while (matchResult = regex.exec(replaceWith)) {
									replaceWith = replaceWith.replace(matchResult[0], tiapp[matchResult[1]]);
								}

								while (matchResult = regexProperty.exec(replaceWith)) {
									replaceWith = replaceWith.replace(matchResult[0], tiapp.getProperty(matchResult[1]));
								}
							}

							tiapp[setting] = replaceWith;

							console.log(
								'Changing '
								+ chalk.cyan(setting)
								+ ' to '
								+ chalk.yellow(replaceWith)
							);
						}

					}

					// settings.properties
					if (config.settings.properties) {

						for (var property in config.settings.properties) {

							if (!config.settings.properties.hasOwnProperty(property)) {
								continue;
							}

							var replaceWith = config.settings.properties[property];

							replaceWith = replacePlaceholders(replaceWith);

							if (typeof replaceWith === 'string') {

								var matchResult;

								while (matchResult = regex.exec(replaceWith)) {
									replaceWith = replaceWith.replace(matchResult[0], tiapp[matchResult[1]]);
								}

								while (matchResult = regexProperty.exec(replaceWith)) {
									replaceWith = replaceWith.replace(matchResult[0], tiapp.getProperty(matchResult[1]));
								}
							}

							var propertyType = 'string';

							_.isInteger(replaceWith) && (propertyType = 'int');

							_.isNumber(replaceWith) && !_.isInteger(replaceWith) && (propertyType = 'double');

							_.isBoolean(replaceWith) && (propertyType = 'bool');

							tiapp.setProperty(property, replaceWith, propertyType);

							console.log(
								'Changing App property '
								+ chalk.cyan(property)
								+ ' to '
								+ chalk.yellow(replaceWith)
							);
						}
					}

					// settings.raw
					if (config.settings.raw) {

						var doc = tiapp.doc;
						var select = xpath.useNamespaces({
							'ti': 'http://ti.appcelerator.org',
							'android': 'http://schemas.android.com/apk/res/android'
						});

						for (var path in config.settings.raw) {

							if (!config.settings.raw.hasOwnProperty(path)) {
								continue;
							}

							var node = select(path, doc, true);

							if (!node) {
								console.log(chalk.yellow('Could not find ' + path + ', skipping'));
								continue;
							}

							// if (node.nodeType === 1) {
							//     console.log(chalk.yellow('ELEMENT_NODE found, skipping'));
							//     continue;
							// }

							var replaceWith = config.settings.raw[path];

							replaceWith = replacePlaceholders(replaceWith);

							var matchResult,
								changed = false;

							while (matchResult = regex.exec(replaceWith)) {
								replaceWith = replaceWith.replace(matchResult[0], tiapp[matchResult[1]]);
							}

							while (matchResult = regexProperty.exec(replaceWith)) {
								replaceWith = replaceWith.replace(matchResult[0], tiapp.getProperty(matchResult[1]));
							}

							if (_.hasIn(node, 'value')) {
								node.value = replaceWith;
								changed = true;
							}
							else if (_.hasIn(node, 'data')) {
								node.data = replaceWith;
								changed = true;
							}
							else if (_.hasIn(node, 'firstChild')) {
								node.firstChild.data = replaceWith;
								changed = true;
							}

							changed && console.log(
								'Changing Raw property '
								+ chalk.cyan(path)
								+ ' to '
								+ chalk.yellow(replaceWith)
							);
						}
					}

					copyDefaultIcon(alloyCfg.global.theme);

					console.log(chalk.green('\n' + outfilename + ' updated\n'));

					tiapp.write(outfilename);
				}
			});

			// console.log(chalk.red('\nCouldn\'t find a config called: ' + name + '\n'));
		}
	}

	function replacePlaceholders(_text) {
		if (typeof _text === 'string') {

			var now = new Date();
			return _text.replace('$DATE$', now.toLocaleDateString())
				.replace('$TIME$', now.toLocaleTimeString())
				.replace('$DATETIME$', now.toLocaleString())
				.replace('$TIME_EPOCH$', now.getTime().toString())
				.replace('$YEAR$', now.getFullYear().toString())
				.replace('$MONTH$', (now.getMonth() + 1).toString())
				.replace('$DAY$', now.getDate().toString());

		}

		//to leave value as it is
		return _text;
	}

    function copyDefaultIcon(_theme) {
        var path = [
            './app/themes/' + _theme + '/assets/iphone/DefaultIcon.png',
            './app/themes/' + _theme + '/DefaultIcon.png'
        ];

        if (fs.existsSync(path[0])) {

		    // if it exists in the themes folder, in a platform subfolder
		    console.log(chalk.blue('Found a DefaultIcon.png in the theme\'s assets/iphone folder\n'));

		    copyFile(path[0], './DefaultIcon.png');
	    }
	    else if (fs.existsSync(path[1])) {

		    // if it exists in the top level theme folder
		    console.log(chalk.blue('Found a DefaultIcon.png in the theme folder\n'));

		    copyFile(path[1], './DefaultIcon.png');
	    }
	    else {
	        console.log(chalk.red('DefaultIcon.png not found in one of theme folder\'s: "' + path[0] + '" , "' + path[1] + '" \n'));
        }
    }

    function readAppConfig() {
	    if (fs.existsSync('./app/config.json')) {
		    return JSON.parse(fs.readFileSync('./app/config.json', 'utf-8'));
	    }

	    return false;
    }

    // setup CLI
    program
        .version(pkg.version, '-v, --version')
        .usage('[options]')
        .description(pkg.description)
        .option('-l, --list', 'Lists the configurations in the project folder')
        .option('-f, --cfgfile <path>', 'Specifies the tich config file to use')
        .option('-i, --in <path>', 'Specifies the file to read (default: tiapp.xml)')
        .option('-o, --out <path>', 'Specifies the file to write (default: tiapp.xml)')
        .option('-s, --select <name>', 'Updates TiApp.xml to config specified by <name>')
		.option('--noalloy', 'Skip update theme on Alloy config.json')
        //.option('-c, --capture <name>', 'Stores the current values of TiApp.xml id, name, version as <name> ')

    program.parse(process.argv);

    var cfgfile = program.cfgfile ? program.cfgfile : 'tich.cfg';
    var infile = program.in ? program.in : './tiapp.xml';
    var outfile = program.out ? program.out : './tiapp.xml';
	var processAlloy = program.noalloy ? false : true;

    // check that all required input paths are good
    [cfgfile, infile].forEach(function (file) {
        if (!fs.existsSync(file)) {
            console.log(chalk.red('Cannot find ' + file));
            program.help();
        }
    });

    // read in our config
    var cfg = JSON.parse(fs.readFileSync(cfgfile, 'utf-8'));

    // read in the app config
    var tiapp = tiappxml.load(infile);

    // Fetch selected config
    var selectedConfig = program.select ? program.select : program.args[1];

    // check for a new version
    updateNotifier({
        packageName: pkg.name,
        packageVersion: pkg.version
    }).notify();

    // LIST command - show the list of config items
    if (program.list) {
        cfg.configs.forEach(function(config) {
            console.log(chalk.cyan(
                config.name
                + ' - '
                + chalk.grey('Name: ') + config.settings.name + ' '
                + chalk.grey('Id: ') + config.settings.id + ' '
                + chalk.grey('Version: ') + config.settings.version
            ));
        });
    }
    // select command, select based on the arg passed
    else if (selectedConfig) {
        select(selectedConfig, outfile);
    }
    // capture command - this will store the current TiApp.xml settings
    else if (program.capture) {
        // coming soon!
    }
    else {
        status();
    }
}
