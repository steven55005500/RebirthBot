// src/utils/getFlagEmoji.js

function getFlagEmoji(countryCode){

 if(!countryCode) return "🌍";

 return countryCode
  .toUpperCase()
  .replace(/./g, char =>
   String.fromCodePoint(127397 + char.charCodeAt())
  );

}

module.exports = getFlagEmoji;