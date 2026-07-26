/* Charted ports. `t` is the port tier — it scales the cargo contracts the port
   offers and the goods it asks for. */

export const PORTS = {
  staug:        { n: 'St. Augustine',   region: 'caribbean', x: 226, y: 368, t: 1 },
  charlestowne: { n: 'Charles-Towne',   region: 'caribbean', x: 254, y: 344, t: 1 },
  jamestown:    { n: 'Jamestown',       region: 'caribbean', x: 268, y: 382, t: 2 },
  veracruz:     { n: 'Veracruz',        region: 'caribbean', x: 84,  y: 336, t: 2 },
  philadelphia: { n: 'Philadelphia',    region: 'caribbean', x: 292, y: 398, t: 2 },
  riodejaneiro: { n: 'Rio de Janeiro',  region: 'caribbean', x: 300, y: 436, t: 2 },

  boston:       { n: 'Boston',          region: 'gulf',      x: 152, y: 262, t: 3 },
  newyork:      { n: 'New York',        region: 'gulf',      x: 190, y: 238, t: 3 },
  montevideo:   { n: 'Monte Video',     region: 'gulf',      x: 22,  y: 300, t: 3 },
  stjohns:      { n: "St-John's",       region: 'gulf',      x: 236, y: 266, t: 4 },
  oporto:       { n: 'Oporto',          region: 'gulf',      x: 296, y: 238, t: 4 },
  canary:       { n: 'Canary Islands',  region: 'gulf',      x: 318, y: 262, t: 4 },
  lisbon:       { n: 'Lisbon',          region: 'gulf',      x: 268, y: 210, t: 4 },
  elsalvador:   { n: 'El Salvador',     region: 'gulf',      x: 34,  y: 222, t: 4 },
  annapolis:    { n: 'Annapolis Royal', region: 'gulf',      x: 130, y: 206, t: 5 },
  casablanca:   { n: 'Casablanca',      region: 'gulf',      x: 66,  y: 168, t: 5 },
  quebec:       { n: 'Quebec',          region: 'gulf',      x: 160, y: 178, t: 5 },
  capetown:     { n: 'Cape Town',       region: 'gulf',      x: 40,  y: 164, t: 5 },
  stmalo:       { n: 'St-Malo',         region: 'gulf',      x: 214, y: 168, t: 5 },
  agadir:       { n: 'Agadir',          region: 'gulf',      x: 330, y: 176, t: 5 },

  benguela:     { n: 'Benguela',        region: 'atlantic',  x: 70,  y: 120, t: 6 },
  brest:        { n: 'Brest',           region: 'atlantic',  x: 214, y: 120, t: 6 },
  larochelle:   { n: 'La Rochelle',     region: 'atlantic',  x: 300, y: 112, t: 6 },
  bissau:       { n: 'Bissau',          region: 'atlantic',  x: 118, y: 142, t: 7 },

  bristol:      { n: 'Bristol',         region: 'grand',     x: 150, y: 80,  t: 7 },
  ziguinchor:   { n: 'Ziguinchor',      region: 'grand',     x: 100, y: 52,  t: 8 },
  galway:       { n: 'Galway',          region: 'grand',     x: 156, y: 34,  t: 8 },
  london:       { n: 'London',          region: 'grand',     x: 204, y: 32,  t: 9 },
  barcelona:    { n: 'Barcelona',       region: 'grand',     x: 264, y: 30,  t: 9 },
  marseille:    { n: 'Marseille',       region: 'grand',     x: 322, y: 44,  t: 10 }
};
