# swgoh-stat-calc-dataBuilder
 
Node package to build the 'gameData' object used by the [swgoh-stat-calc package](https://www.npmjs.com/package/swgoh-stat-calc), by pulling data from the [swgoh.help API](http://api.swgoh.help).

## Setup ##

### Installation ###
`npm install swgoh-stat-calc-dataBuilder`

### Initialization ###

Two options:
* `.fromPrefs` will create an internal instance of [ApiSwgohHelp](https://www.npmjs.com/package/api-swgoh-help).
* `.fromApiSwgohHelp` will use an instance of [ApiSwgohHelp](https://www.npmjs.com/package/api-swgoh-help) that you create first.

#### .fromPrefs ####

```js
const dataBuilder = require('swgoh-stat-calc-data-builder').fromPrefs({
  username: <swgoh.help username>,
  password: <swgoh.help password>
});
let path = __dirname + '/../statCalcData/';
dataBuilder.loadData(path).then( ... );
```

See the [api-swgoh-help package](https://www.npmjs.com/package/api-swgoh-help) for possible options to provide.
Username and password, as shown above, are required.

#### .fromApiSwgohHelp ####

```js
const ApiSwgohHelp = require('api-swgoh-help');
const swapi = new ApiSwgohHelp({
  username: <swgoh.help username>,
  password: <swgoh.help password>
});
const dataBuilder = require('swgoh-stat-calc-data-builder').fromApiSwgohHelp(swapi);
let path = __dirname + '/../statCalcData/';
dataBuilder.loadData(path).then( ... );
```

Allows you to use the same instance of [ApiSwgohHelp](https://www.npmjs.com/package/api-swgoh-help) after loading data.

## Methods ##

* .loadData(path)
* .getData()
* .getVersion()
* .isUpdated()

### async .loadData(path) ###

Attempts to query swogh.help to collect the data needed and build the 'gameData' object.  Will save 'gameData.json' and 'dataVersion.json' files to the given folder.

#### Parameters ####

`path`*String*\
The path to the folder where the .json files should be saved.
Will also use that path to check for and cache temp files in case not all data can be aquired in one go.

#### Return Value ####

`true` if data was loaded successfully (either current data already found, or fresh data acquired).\
`false` if data failed to load the newest.  Stale data may have been loaded in its place in case needed.

### .getData() ###

Returns the currently loaded 'gameData' object.

#### Parameters ####

None.

#### Return Value ####

The currently loaded 'gameData' object.
Before `.loadData()` is called, this is an empty object.
Afterwards, it may contain partial data if `.loadData()` is still running, and stale data if `.loadData()` failed.
Use `.isUpdated()` to check the current update status.

### .getVersion() ###

Returns the current version object.
Will match the format used by swgoh.help's version endpoint here: [https://api.swgoh.help/version](https://api.swgoh.help/version)
Can be compared with their object to determine if data is fully updated.

#### Parameters ####

None.

#### Return Value ####

The current version object.
Before `.loadData()` is called, this is `undefined`.
It's updated to the current version of [swgoh.help's API](https://api.swgoh.help/version) when `.loadData()` starts.
If `.loadData()` fails and stale data is loaded, it should revert to the stale version info as well.

### .isUpdated() ###

Returns the current update status.

#### Parameters ####

None.

#### Return Value ####

`undefined` if `.loadData()` has not yet been called.\
`true` if `.loadData()` successfully updated.\
`false` if `.loadData()` is in progress, or has failed.

## Examples ##

Assuming this is being used in conjunction with the [swgoh-stat-calc](https://www.npmjs.com/package/swgoh-stat-calc) package:

```js
const statCalculator = require('swgoh-stat-calc');
const dataBuilder = require('swgoh-stat-calc-data-builder')({
  username: process.env.SWGOH_HELP_UNAME,
  password: process.env.SWGOH_HELP_PASS
});

await databuilder.loadData(__dirname + '/../statCalcData/');
statCalculator.setGameData( dataBuilder.getData() );
```

If an instance of ApiSwgohHelp should be shared with the dataBuilder and your remaining code:

```js
const ApiSwgohHelp = require('api-swgoh-help');
const swapi = new ApiSwgohHelp({
  "username":process.env.SWGOH_HELP_UNAME,
  "password":process.env.SWGOH_HELP_PASS
});
const statCalculator = require('swgoh-stat-calc');
const dataBuilder = require('swgoh-stat-calc-data-builder')(swapi);

await databuilder.loadData(__dirname + '/../statCalcData/');
statCalculator.setGameData( dataBuilder.getData() );
```


