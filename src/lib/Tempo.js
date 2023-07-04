export default class Tempo {

    static tempos = [
        ['',    'Dance',        0,      0   ],
        ['C2',  'C2S',          140,    230 ],
        ['WC',  'WCS',          70,     128 ],
        ['HU',  'Hustle',       90,     128 ],
        ['PO',  'Polka',        106,    124 ],
        ['TR',  'TR2',          76,     84  ],
        ['NC',  'NC',           54,     84  ],
        ['WA',  'Waltz',        84,     93  ],
        ['CC',  'Cha-Cha',      102,    128 ],
        ['EC',  'ECS',          126,    144 ],
        ['FT',  'Foxtrot',      108,    124 ],
        ['TA',  'Tango',        58,     66  ],
        ['VW',  'VW',           156,    180 ],
        ['QS',  'QS',           196,    208 ],
        ['BO',  'Bolero',       88,     96  ],
        ['SM',  'Samba',        96,     104 ],
        ['RU',  'Rumba',        96,     128 ],
        //['JI',  'Jive',         168,    176 ],
        //['SL',  'Salsa',        192,    208 ],
        //['MA',  'Mambo',        184,    192 ],
        //['ME',  'Merengue',     60,     68  ],
        //['BA',  'Bachata',      112,    128 ],
        //['PD',  'Paso',         106,    124 ],
        //['PB',  'Peabody',      235,    244 ],
    ];

    static tempoList = Tempo.tempos.map( (item) => {
        return { key: item[0], dance: item[1], lowBpm: item[2], highBpm: item[3] };
    });

    static tempoMap = new Map(Tempo.tempos.map( (item) => {
        return [item[0], {dance: item[1], lowBpm: item[2], highBpm: item[3]}];
    }));

    static normalizeBpm(item, key) {
        if (key) {
            const bpm = item.bpm;
            if (typeof bpm == 'number' && bpm > 0) {
                const {lowBpm, highBpm} = Tempo.tempoMap.get(key);
                if (bpm < lowBpm || bpm > highBpm) {
                    const newBpm = bpm > highBpm ? bpm / 2 : bpm * 2;
                    if (newBpm >= lowBpm && newBpm <= highBpm) {
                        return {...item, bpm: newBpm};
                    }
                }
                return item;
            }
            else {
                return {...item, bpm: 0};
            }
        }
        else {
            return item;
        }
    }

}
