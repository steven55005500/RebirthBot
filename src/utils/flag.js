// src/utils/flag.js

const getFlagEmoji = require("./getFlagEmoji");

// Country name → ISO code map (common countries)
const countryMap = {

 "India":"IN",
 "Sri Lanka":"LK",
 "Nepal":"NP",
 "Bangladesh":"BD",
 "Pakistan":"PK",
 "United Arab Emirates":"AE",
 "UAE":"AE",
 "United States":"US",
 "USA":"US",
 "Afghanistan":"AF",
 "United Kingdom":"GB",
 "UK":"GB",
 "Canada":"CA",
 "Australia":"AU",
 "Germany":"DE",
 "France":"FR",
"Italy":"IT",
"Spain":"ES",
"Russia":"RU",
"China":"CN",
"Japan":"JP",
"Bhutan":"BT",
"Oman":"OM",
 "South Korea":"KR",
 "Indonesia":"ID",
 "Malaysia":"MY",
 "Singapore":"SG",
 "Thailand":"TH",
 "Vietnam":"VN",
 "Philippines":"PH",
 "Brazil":"BR",
 "Mexico":"MX",
 "Turkey":"TR",
 "Saudi Arabia":"SA",
 "South Africa":"ZA"

};

function getCountryFlag(country){

 if(!country) return "🌍";

 const code = countryMap[country.trim()];

 if(!code) return "🌍";

 return getFlagEmoji(code);

}

module.exports = getCountryFlag;