let gameData = {};
const ApiSwgohHelp = require('api-swgoh-help');
const fetch = require('node-fetch');
const fs = require('fs');
let swapi, dataPath, apiVer, updated;

module.exports = (swapiPrefs) => {
  swapi = new ApiSwgohHelp(swapiPrefs);
  return {
    loadData: loadData,
    getData: () => { return gameData; },
    getVersion: () => { return apiVer; },
    isUpdated: () => { return updated; }
  };
};

// Helper method for recursively deleting folders
function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach( file => {
      let curPath = path + '/' + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}
// Helper method for memoizing functions
// Note: original code for this function taken directly from:
//   https://medium.com/@bluepnume/async-javascript-is-much-more-fun-when-you-spend-less-time-thinking-about-control-flow-8580ce9f73fc
function memoize(method) {
  let cache = {};

  return function() { // original code has 'async' in this line.  Seems unnecessary.
    let args = JSON.stringify(arguments);
    cache[args] = cache[args] || method.apply(this, arguments);
    return cache[args];
  };
}
// Helper method for wrapping data building functions in temp file checking code
async function checkTempFiles(folder, aSyncMethod) {
  let tempVer;
  try {
    tempVer = require(folder + '/version.json');
    if (tempVer && tempVer.game == apiVer.game && tempVer.language == apiVer.language) {
      console.log(`Valid temporary data found in ${folder}.  Will not re-request.`);
      return require(folder + '/data.json');
    }
  } catch(e) { }
  
  try {
    let data = await aSyncMethod();
    
    fs.mkdirSync(folder, {recursive: true});
    fs.writeFileSync(folder + '/data.json', JSON.stringify( data ) );
    fs.writeFileSync(folder + '/version.json', JSON.stringify( apiVer ) );
    
    console.log(`saved temp data in ${folder}`);
    
    return data;
  } catch(e) {
    console.error(e.stack)
    return;
  }
}

// Check for updates, rebuild data if necessary.  Return gameData
async function loadData(dataFolder) {
  console.log(`Loading Data from ${dataFolder}gameData.json`);
  updated = false;
  try {
    dataPath = `${dataFolder}${dataFolder.slice(-1) == '/' ? '':'/'}`;
    if (await checkVersions())
      throw new Error(`Current Data Outdated`);
    // if still here, data is already updated
    gameData = require(`${dataPath}gameData.json`);
    updated = true;
  } catch (e) {
    console.error(e.message);
    if (await buildData()) {
      // successfully built game data.
      // save version, and cleanup folders.
      fs.writeFileSync(`${dataPath}gameData.json`, JSON.stringify(gameData, null, 2) );
      fs.writeFileSync(`${dataPath}dataVersion.json`, JSON.stringify(apiVer) );
      deleteFolderRecursive(`${dataPath}temp`);
      console.log("Saved new copy of gameData.json");
      updated = true;
    } else {
      console.error("Trying to reuse stale data.");
      gameData = require(`${dataPath}gameData.json`);
      apiVer = require(`${dataPath}dataVersion.json`);
    }
  }
  return updated;
}

// Check for new Versions.  Assigns value to global 'apiVer' object.
// Returns true if new version available, false if not.
async function checkVersions() {
  let curVer;
  try {
    apiVer = await (await fetch('https://api.swgoh.help/version')).json();
    console.log(`apiVer: ${JSON.stringify(apiVer)}`);
    curVer = require(dataPath + 'dataVersion.json');
    console.log(`curVer: ${JSON.stringify(curVer)}`);
    return (curVer.game != apiVer.game || curVer.language != apiVer.language);
  } catch(e) {
    console.error(`Error checking game versions:`);
    console.error(e.stack);
    return !curVer;
  }
}

// Build gameData object through swapi.  Returns true if successful.
async function buildData() {
  console.log("Retrieving new gameData from api.swgoh.help");
  let errored = false,
      setErrorFlag = (e) => {console.error(e.stack); errored = true; };
  await Promise.all([
    loadGearData().catch(setErrorFlag),
    loadModSetData().catch(setErrorFlag),
    loadTableData().catch(setErrorFlag),
    loadUnitData().catch(setErrorFlag),
    loadRelicData().catch(setErrorFlag)
  ]);
  return !errored;
}

async function loadGearData() {
  let data = await checkTempFiles(dataPath + 'temp/gearData', async () => {
    const {result: list, error: error} = await swapi.fetchData({ collection:"equipmentList", project: {id:1,equipmentStat:1} });
    
    if (error) throw error;
    
    const data = {};
    list.forEach( gear => {
      const statList = gear.equipmentStat.statList;
      if (statList.length > 0) {
        data[ gear.id ] = { stats: {} };
        statList.forEach( stat => {
          data[ gear.id ].stats[ stat.unitStatId ] = stat.unscaledDecimalValue;
        });
      }
    });
    
    return data;
  });
  
  if (!data) throw new Error('Failed to load GearData');
  
  gameData.gearData = data;
  return;
}

async function loadModSetData() {
  let data = await checkTempFiles(dataPath + 'temp/modSetData', async () => {
    const {result: list, error: error} = await swapi.fetchData({ collection:"statModSetList", project: {id:1,completeBonus:1,setCount:1} });
    
    if (error) throw error;
    
    const data = {};
    list.forEach( set => {
      data[ set.id ] = {
        id: set.completeBonus.stat.unitStatId,
        count: set.setCount,
        value: set.completeBonus.stat.unscaledDecimalValue
      };
    });
    
    return data;
  });
  
  if (!data) throw new Error('Failed to load ModSetData');
  
  gameData.modSetData = data;
  return;
}

async function loadTableData() {
  // request and process 'tableList' and 'xpTableList' in parallel
  let data = await checkTempFiles(dataPath + 'temp/tableData', async () => {
    const data = {cr: {}, gp: {}};
    const parseTableList = ({ result: list, error: error }) => {
      if (error) throw error;
      
      const rarityEnum = {
        "ONE_STAR": 1,
        "TWO_STAR": 2,
        "THREE_STAR": 3,
        "FOUR_STAR": 4,
        "FIVE_STAR": 5,
        "SIX_STAR": 6,
        "SEVEN_STAR": 7
      };
      const statEnum = getStatEnum();
      
      list.forEach( table => {
        let c, g;
        switch( table.id ) {
          case "galactic_power_modifier_per_ship_crew_size_table":
            data.gp.crewSizeFactor = {}
            table.rowList.forEach( row => {
              data.gp.crewSizeFactor[ row.key ] = +row.value;
            });
            data.cr.crewSizeFactor = data.gp.crewSizeFactor; // used for both GP and CR
            break;
          case "crew_rating_per_unit_rarity":
            data.cr.crewRarityCR = {};
            table.rowList.forEach( row => {
              data.cr.crewRarityCR[ rarityEnum[row.key] ] = +row.value;
            });
            data.gp.crewRarityGP = data.cr.crewRarityCR; // used for both CR and GP
            break;
          case "crew_rating_per_gear_piece_at_tier":
            data.cr.gearPieceCR = {};
            table.rowList.forEach( row => {
              data.cr.gearPieceCR[ row.key.match(/TIER_0?(\d+)/)[1] ] = +row.value;
            });
            break;
          case "galactic_power_per_complete_gear_tier_table":
            data.gp.gearLevelGP = {};
            table.rowList.forEach( row => {
              // 'complete gear tier' is one less than current gear level, so increment key by one
              data.gp.gearLevelGP[ ++(row.key.match(/TIER_0?(\d+)/)[1]) ] = +row.value;
            });
            break;
          case "galactic_power_per_tier_slot_table":
            g = data.gp.gearPieceGP = {};
            table.rowList.forEach( row => {
              let [ tier, slot ] = row.key.split(":");
              g[ tier ] = g[ tier ] || {}; // ensure table exists for this gear level
              g[ tier ][ slot ] = +row.value;
            });
            break;
          case "crew_contribution_multiplier_per_rarity":
            data.cr.shipRarityFactor = {};
            table.rowList.forEach( row => {
              data.cr.shipRarityFactor[ rarityEnum[row.key] ] = +row.value;
            });
            data.gp.shipRarityFactor = data.cr.shipRarityFactor; // used for both CR and GP
            break;
          case "galactic_power_per_tagged_ability_level_table":
            g = data.gp.abilitySpecialCR = {};
            table.rowList.forEach( row => {
              if ( row.key == "zeta" ) g[ row.key ] = +row.value;
              else {
                let [ , type, level] = row.key.match(/^(\w+)_\w+?(\d)?$/);
                switch (type) {
                  case "contract":
                    g[ type ] = g[ type ] || {}; // ensure 'contract' table exists
                    g[ type ][ ++level || 1 ] = +row.value;
                    break;
                  case "reinforcement":
                    g[ "hardware" ] = g[ "hardware" ] || {1: 0}; // ensure 'hardware' table exists (and counts 0 xp for tier 1)
                    g[ "hardware" ][ ++level ] = +row.value;
                    break;
                  default:
                    console.error(`Unknown ability type '${row.key}' found.`);
                }
              }
            });
            break;
          case "crew_rating_per_mod_rarity_level_tier":
            c = data.cr.modRarityLevelCR = {};
            g = data.gp.modRarityLevelTierGP = {};
            table.rowList.forEach( row => {
              if ( row.key.slice(-1) == "0") { // only 'select' set 0, as set doesn't affect CR or GP
                let [ pips, level, tier, set ] = row.key.split(":");
                if ( +tier == 1) { // tier doesn't affect CR, so only save for tier 1
                  c[ pips ] = c[ pips ] || {}; // ensure table exists for that rarity
                  c[ pips ][ level ] = +row.value;
                }
                g[ pips ] = g[ pips ] || {}; // ensure rarity table exists
                g[ pips ][ level ] = g[ pips ][ level ] || {}; // ensure level table exists
                g[ pips ][ level ][ tier ] = +row.value;
              }
            });
            break;
          case "crew_rating_modifier_per_relic_tier":
            data.cr.relicTierLevelFactor = {};
            table.rowList.forEach( row => {
              data.cr.relicTierLevelFactor[ +row.key + 2 ] = +row.value; // relic tier enum is relic level + 2
            });
            break;
          case "crew_rating_per_relic_tier":
            data.cr.relicTierCR = {};
            table.rowList.forEach( row => {
              data.cr.relicTierCR[ +row.key + 2 ] = +row.value;
            });
            break;
          case "galactic_power_modifier_per_relic_tier":
            data.gp.relicTierLevelFactor = {};
            table.rowList.forEach( row => {
              data.gp.relicTierLevelFactor[ +row.key + 2 ] = +row.value; // relic tier enum is relic level + 2
            });
            break;
          case "galactic_power_per_relic_tier":
            data.gp.relicTierGP = {};
            table.rowList.forEach( row => {
              data.gp.relicTierGP[ +row.key + 2 ] = +row.value;
            });
            break;
          case "crew_rating_modifier_per_ability_crewless_ships":
            data.cr.crewlessAbilityFactor = {};
            table.rowList.forEach( row => {
              data.cr.crewlessAbilityFactor[ row.key ] = +row.value;
            });
            break;
          case "galactic_power_modifier_per_ability_crewless_ships":
            data.gp.crewlessAbilityFactor = {};
            table.rowList.forEach( row => {
              data.gp.crewlessAbilityFactor[ row.key ] = +row.value;
            });
            break;
          case (table.id.match(/_mastery/) || {}).input: // id matches itself only if it ends in _mastery
            // These are not actually CR or GP tables, but were placed in the 'crTables' section of gameData when first implemented.
            // Still placed there for backwards compatibility
            data.cr[ table.id ] = {};
            table.rowList.forEach( row => {
              data.cr[ table.id ][ statEnum[row.key] ] = +row.value;
            });
            break;
          default:
            return;
        }
      });
    };
    const parseXPTableList = ({ result: list, error: error }) => {
      if (error) throw error;
      
      list.forEach( table => {
        let tempTable = {};
        if ( /^crew_rating/.test(table.id) || /^galactic_power/.test(table.id) ) {
          table.rowList.forEach( row => {
            tempTable[ ++row.index ] = row.xp;
          });
          switch ( table.id ) {
            // 'CR' tables appear to be for both CR and GP on characters
            // 'GP' tables specify ships, but are currently idendical to the 'CR' tables.
            case "crew_rating_per_unit_level":
              data.cr.unitLevelCR = tempTable;
              data.gp.unitLevelGP = tempTable;
              break;
            case "crew_rating_per_ability_level":
              data.cr.abilityLevelCR = tempTable;
              data.gp.abilityLevelGP = tempTable;
              break;
            case "galactic_power_per_ship_level_table":
              data.gp.shipLevelGP = tempTable;
              break;
            case "galactic_power_per_ship_ability_level_table":
              data.gp.shipAbilityLevelGP = tempTable;
              break;
            default:
              return;
          }
        }
      });
    };
    
    await Promise.all([
      swapi.fetchData({ collection:"tableList" }).then(parseTableList),
      swapi.fetchData({ collection:"xpTableList" }).then(parseXPTableList)
    ]);
    
    return data;
  });
  
  if (!data) throw new Error('Failed to load TableData');
  
  gameData.crTables = data.cr;
  gameData.gpTables = data.gp;
  return;
}

async function loadUnitData() {
  let data = await checkTempFiles(dataPath + 'temp/unitData', async () => {
    const [
      statTables,
      skills,
      baseList,
      unitGMTables
    ] = await Promise.all([
      getStatProgressionList(),
      swapi.fetchData({ collection:"skillList", project: {id:1, tierList:1} }).then( ({result: skillList, error: error}) => {
        if (error) throw error;
        let skills = {};
        skillList.forEach( skill => {
          skills[ skill.id ] = { id: skill.id, maxTier: skill.tierList.length + 1, isZeta: skill.tierList.slice(-1)[0].powerOverrideTag == "zeta" };
        });
        return skills;
      }),
      swapi.fetchData({
        collection:"unitsList",
        match:{rarity:1, obtainable:true, obtainableTime:0},
        project:{combatType:1, primaryUnitStat:1, baseId:1, unitTierList:1, crewContributionTableId:1, crewList:1, categoryIdList:1, skillReferenceList:1, baseStat:1, relicDefinition:1}
      }).then( ({result: baseList, error: error}) => { if (error) throw error; return baseList; }),
      swapi.fetchData({
        collection:"unitsList",
        match:{obtainable:true, obtainableTime:0},
        project:{rarity:1, baseId:1, statProgressionId:1}
      }).then( async ({result: unitGMList, error: error}) => {
        if (error) throw error;
        const unitGMTables = {},
              statTables = await getStatProgressionList();
        unitGMList.forEach( unit => {
          unitGMTables[ unit.baseId ] = unitGMTables[ unit.baseId ] || {}; // ensure unit's table exists
          unitGMTables[ unit.baseId ][ unit.rarity ] = statTables[ unit.statProgressionId ];
        });
        return unitGMTables;
      })
    ]);
  
    const data = {};
    function getMasteryMultiplierName(primaryStatID, tags) {
      let primaryStats = {
        2: "strength",
        3: "agility",
        4: "intelligence"
      };
      let [role] = tags.filter( tag => /^role_(?!leader)[^_]+/.test(tag)); // select 'role' tag that isn't role_leader
      return `${primaryStats[ primaryStatID ]}_${role}_mastery`;
    }
    baseList.forEach( unit => {
      if ( unit.combatType == 1 ) { // character
        const tierData = {};
        const relicData = {};
        unit.unitTierList.forEach( gearTier => {
          tierData[ gearTier.tier ] = { gear: gearTier.equipmentSetList, stats: {}}
          gearTier.baseStat.statList.forEach( stat => {
            tierData[ gearTier.tier ].stats[ stat.unitStatId ] = stat.unscaledDecimalValue;
          });
        });
        unit.relicDefinition.relicTierDefinitionIdList.forEach( tier => {
          relicData[ +tier.slice(-2) + 2 ] = tier;
        });
        data[unit.baseId] = { combatType: 1,
                              primaryStat: unit.primaryUnitStat,
                              gearLvl: tierData,
                              growthModifiers: unitGMTables[ unit.baseId ],
                              skills: unit.skillReferenceList.map( skill => skills[ skill.skillId ] ),
                              relic: relicData,
                              masteryModifierID: getMasteryMultiplierName(unit.primaryUnitStat, unit.categoryIdList)
                            };
      } else { // ship
        const stats = {}
        unit.baseStat.statList.forEach( stat => {
          stats[ stat.unitStatId ] = stat.unscaledDecimalValue;
        });
        data[unit.baseId] = { combatType: 2,
                              primaryStat: unit.primaryUnitStat,
                              stats: stats,
                              growthModifiers: unitGMTables[ unit.baseId ],
                              crewStats: statTables[ unit.crewContributionTableId ],
                              crew: unit.crewList.map( crew => crew.unitId)
                            };
      }
    });
    
    return data;
  });
  
  if (!data) throw new Error('Failed to load UnitData');
  
  gameData.unitData = data;
  return;
}

async function loadRelicData() {
  let data = await checkTempFiles(dataPath + 'temp/relicData', async () => {
    const [ statTables, {result: list, error: error} ] = await Promise.all([
      getStatProgressionList(),
      swapi.fetchData({ collection:"relicTierDefinitionList", project: {id:1,stat:1,relicStatTable:1} })
    ]);
    
    if (error) throw error;
    
    const data = {};
    list.forEach( relic => {
      data[ relic.id ] = { stats: {}, gms: statTables[ relic.relicStatTable ] };
      relic.stat.statList.forEach( stat => {
        data[ relic.id ].stats[ stat.unitStatId ] = stat.unscaledDecimalValue;
      });
    });
    
    return data;
  });
  
  if (!data) throw new Error('Failed to load RelicData');
  
  gameData.relicData = data;
  return;
}

const getStatProgressionList = memoize(async () => {
  let response = await swapi.fetchData({ collection:"statProgressionList", project: {id:1,stat:1} });
  if (response.error) throw new Error(response.error);
  const statTables = {};
  response.result.forEach( table => {
    if ( /^stattable_/.test(table.id) ) {
      const tableData = {};
      table.stat.statList.forEach(stat => {
        tableData[ stat.unitStatId ] = stat.unscaledDecimalValue;
      });
      statTables[ table.id ] = tableData;
    }
  });
  return statTables;
});

function getStatEnum() {
  // Set as a function to determine a proper way to get it at some point.
  // Hard-coded for now, as I'm not sure what that proper way would be.
  return {
    MAX_HEALTH: 1,
    STRENGTH: 2,
    AGILITY: 3,
    INTELLIGENCE: 4,
    SPEED: 5,
    ATTACK_DAMAGE: 6,
    ABILITY_POWER: 7,
    ARMOR: 8,
    SUPPRESSION: 9,
    ARMOR_PENETRATION: 10,
    SUPPRESSION_PENETRATION: 11,
    DODGE_RATING: 12,
    DEFLECTION_RATING: 13,
    ATTACK_CRITICAL_RATING: 14,
    ABILITY_CRITICAL_RATING: 15,
    CRITICAL_DAMAGE: 16,
    ACCURACY: 17,
    RESISTANCE: 18,
    DODGE_PERCENT_ADDITIVE: 19,
    DEFLECTION_PERCENT_ADDITIVE: 20,
    ATTACK_CRITICAL_PERCENT_ADDITIVE: 21,
    ABILITY_CRITICAL_PERCENT_ADDITIVE: 22,
    ARMOR_PERCENT_ADDITIVE: 23,
    SUPPRESSION_PERCENT_ADDITIVE: 24,
    ARMOR_PENETRATION_PERCENT_ADDITIVE: 25,
    SUPPRESSION_PENETRATION_PERCENT_ADDITIVE: 26,
    HEALTH_STEAL: 27,
    MAX_SHIELD: 28,
    SHIELD_PENETRATION: 29,
    HEALTH_REGEN: 30,
    ATTACK_DAMAGE_PERCENT_ADDITIVE: 31,
    ABILITY_POWER_PERCENT_ADDITIVE: 32,
    DODGE_NEGATE_PERCENT_ADDITIVE: 33,
    DEFLECTION_NEGATE_PERCENT_ADDITIVE: 34,
    ATTACK_CRITICAL_NEGATE_PERCENT_ADDITIVE: 35,
    ABILITY_CRITICAL_NEGATE_PERCENT_ADDITIVE: 36,
    DODGE_NEGATE_RATING: 37,
    DEFLECTION_NEGATE_RATING: 38,
    ATTACK_CRITICAL_NEGATE_RATING: 39,
    ABILITY_CRITICAL_NEGATE_RATING: 40,
    OFFENSE: 41,
    DEFENSE: 42,
    DEFENSE_PENETRATION: 43,
    EVASION_RATING: 44,
    CRITICAL_RATING: 45,
    EVASION_NEGATE_RATING: 46,
    CRITICAL_NEGATE_RATING: 47,
    OFFENSE_PERCENT_ADDITIVE: 48,
    DEFENSE_PERCENT_ADDITIVE: 49,
    DEFENSE_PENETRATION_PERCENT_ADDITIVE: 50,
    EVASION_PERCENT_ADDITIVE: 51,
    EVASION_NEGATE_PERCENT_ADDITIVE: 52,
    CRITICAL_CHANCE_PERCENT_ADDITIVE: 53,
    CRITICAL_NEGATE_CHANCE_PERCENT_ADDITIVE: 54,
    MAX_HEALTH_PERCENT_ADDITIVE: 55,
    MAX_SHIELD_PERCENT_ADDITIVE: 56,
    SPEED_PERCENT_ADDITIVE: 57,
    COUNTER_ATTACK_RATING: 58,
    TAUNT: 59
  };
}




