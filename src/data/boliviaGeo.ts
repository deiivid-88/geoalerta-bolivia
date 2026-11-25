export interface ProtectedArea {
  id: string;
  name: string;
  category: string;
  department: string;
  polygon: [number, number][];
}

export interface ReferenceMiningPolygon {
  id: string;
  code: string;
  name: string;
  holderType: string;
  department: string;
  municipality: string;
  status: string;
  polygon: [number, number][];
}

export interface MunicipalityOption {
  name: string;
  province: string;
  lat: number;
  lng: number;
  communities: string[];
}

export interface DepartmentInfo {
  name: string;
  code: string;
  center: [number, number];
  zoom: number;
  municipalities: MunicipalityOption[];
  polygon: [number, number][];
}

export const BOLIVIA_CENTER: [number, number] = [-16.35, -64.4];
export const BOLIVIA_ZOOM = 6;

export const DEPARTMENTS: DepartmentInfo[] = [
  {
    name: 'Pando',
    code: 'PD',
    center: [-11.1, -67.3],
    zoom: 8,
    municipalities: [
      {
        name: 'Puerto Rico',
        province: 'Manuripi',
        lat: -11.1,
        lng: -67.55,
        communities: ['Comunidad Batraja', 'San Pedro', 'Conquista']
      },
      {
        name: 'Sena',
        province: 'Madre de Dios',
        lat: -11.45,
        lng: -67.24,
        communities: ['El Sena', 'Las Piedras', 'Miraflores']
      }
    ],
    polygon: [
      [-9.68, -66.8],
      [-9.95, -65.35],
      [-10.42, -65.38],
      [-10.95, -66.1],
      [-11.6, -67.15],
      [-12.15, -68.65],
      [-11.35, -69.56],
      [-10.95, -69.56],
      [-10.45, -68.9],
      [-9.95, -67.9]
    ]
  },
  {
    name: 'Beni',
    code: 'BN',
    center: [-13.6, -65.3],
    zoom: 7,
    municipalities: [
      {
        name: 'Riberalta',
        province: 'Vaca Díez',
        lat: -11.0,
        lng: -66.06,
        communities: ['Cachuela Esperanza', 'Tumichucua', 'Warnes']
      },
      {
        name: 'Rurrenabaque',
        province: 'General José Ballivián',
        lat: -14.44,
        lng: -67.53,
        communities: ['San Buenaventura Norte', 'Carmen del Emero', 'Asunción del Quiquibey']
      },
      {
        name: 'Guayaramerín',
        province: 'Vaca Díez',
        lat: -10.82,
        lng: -65.36,
        communities: ['Villa Bella', 'Cachuela Mamoré', 'Rosario del Yata']
      }
    ],
    polygon: [
      [-10.42, -65.38],
      [-10.85, -65.1],
      [-12.1, -64.4],
      [-13.5, -62.5],
      [-14.6, -63.4],
      [-15.7, -64.9],
      [-15.5, -66.7],
      [-14.5, -67.55],
      [-13.1, -67.2],
      [-11.6, -67.15],
      [-10.95, -66.1]
    ]
  },
  {
    name: 'La Paz',
    code: 'LP',
    center: [-15.55, -68.05],
    zoom: 7,
    municipalities: [
      {
        name: 'Tipuani',
        province: 'Larecaja',
        lat: -15.55,
        lng: -68.0,
        communities: ['Chima', 'Unutuluni', 'Cangallí']
      },
      {
        name: 'Guanay',
        province: 'Larecaja',
        lat: -15.49,
        lng: -67.88,
        communities: ['Teoponte Sur', 'Uyapi', 'Challana']
      },
      {
        name: 'Mapiri',
        province: 'Larecaja',
        lat: -15.31,
        lng: -68.22,
        communities: ['Santa Rosa de Mapiri', 'Achiquiri', 'Vilaque']
      },
      {
        name: 'Teoponte',
        province: 'Larecaja',
        lat: -15.5,
        lng: -67.82,
        communities: ['Teoponte', 'Pajonal', 'Ticumbaya']
      },
      {
        name: 'Apolo',
        province: 'Franz Tamayo',
        lat: -14.72,
        lng: -68.42,
        communities: ['Azariamas', 'Santa Cruz del Valle Ameno', 'Aten']
      }
    ],
    polygon: [
      [-12.15, -68.65],
      [-11.6, -67.15],
      [-13.1, -67.2],
      [-14.5, -67.55],
      [-15.5, -66.7],
      [-16.9, -67.1],
      [-17.6, -68.4],
      [-17.3, -69.5],
      [-16.0, -69.1],
      [-14.6, -69.1],
      [-13.2, -68.9]
    ]
  },
  {
    name: 'Santa Cruz',
    code: 'SC',
    center: [-17.0, -61.5],
    zoom: 6,
    municipalities: [
      {
        name: 'San Ignacio de Velasco',
        province: 'José Miguel de Velasco',
        lat: -16.37,
        lng: -60.96,
        communities: ['Santa Ana de Velasco', 'San Rafaelito', 'Tierra Hermosa']
      },
      {
        name: 'San Ramón',
        province: 'Ñuflo de Chávez',
        lat: -16.61,
        lng: -62.5,
        communities: ['San Javier Norte', 'Santa Rosa de la Mina', 'El Puente']
      },
      {
        name: 'Puerto Quijarro',
        province: 'Germán Busch',
        lat: -19.0,
        lng: -57.71,
        communities: ['Arroyo Concepción', 'Tamengo', 'Mutún Sur']
      }
    ],
    polygon: [
      [-13.5, -62.5],
      [-13.7, -60.5],
      [-15.2, -60.2],
      [-16.4, -58.3],
      [-18.0, -57.6],
      [-19.6, -57.9],
      [-20.1, -59.5],
      [-20.1, -62.2],
      [-19.5, -63.5],
      [-18.1, -64.4],
      [-17.1, -64.6],
      [-15.7, -64.9],
      [-14.6, -63.4]
    ]
  },
  {
    name: 'Cochabamba',
    code: 'CB',
    center: [-17.35, -65.5],
    zoom: 8,
    municipalities: [
      {
        name: 'Villa Tunari',
        province: 'Chapare',
        lat: -16.97,
        lng: -65.42,
        communities: ['Chipiriri', 'San Francisco', 'Eterazama']
      },
      {
        name: 'Mizque',
        province: 'Mizque',
        lat: -17.94,
        lng: -65.34,
        communities: ['Tin Tin', 'Molinero', 'Aguada']
      }
    ],
    polygon: [
      [-15.7, -64.9],
      [-17.1, -64.6],
      [-18.1, -64.4],
      [-18.4, -65.5],
      [-17.9, -66.7],
      [-16.9, -67.1],
      [-15.5, -66.7]
    ]
  },
  {
    name: 'Oruro',
    code: 'OR',
    center: [-18.6, -67.3],
    zoom: 8,
    municipalities: [
      {
        name: 'Huanuni',
        province: 'Pantaleón Dalence',
        lat: -18.29,
        lng: -66.84,
        communities: ['Cataricagua', 'Bombeo', 'Morococala']
      },
      {
        name: 'Challapata',
        province: 'Eduardo Avaroa',
        lat: -18.9,
        lng: -66.77,
        communities: ['Huancané', 'Culta', 'Cacachaca']
      },
      {
        name: 'Poopó',
        province: 'Poopó',
        lat: -18.38,
        lng: -66.96,
        communities: ['Venta y Media', 'Pazña', 'Urmiri']
      }
    ],
    polygon: [
      [-17.6, -68.4],
      [-16.9, -67.1],
      [-17.9, -66.7],
      [-19.2, -66.5],
      [-19.8, -67.7],
      [-19.4, -68.7],
      [-18.2, -69.1]
    ]
  },
  {
    name: 'Potosí',
    code: 'PT',
    center: [-20.3, -66.4],
    zoom: 7,
    municipalities: [
      {
        name: 'Potosí',
        province: 'Tomás Frías',
        lat: -19.58,
        lng: -65.75,
        communities: ['Cerro Rico', 'Cantumarca', 'San Antonio']
      },
      {
        name: 'Uyuni',
        province: 'Antonio Quijarro',
        lat: -20.46,
        lng: -66.82,
        communities: ['Colchani', 'Pulacayo', 'Río Grande']
      },
      {
        name: 'Llallagua',
        province: 'Rafael Bustillo',
        lat: -18.42,
        lng: -66.58,
        communities: ['Siglo XX', 'Catavi', 'Uncía Norte']
      },
      {
        name: 'Atocha',
        province: 'Sud Chichas',
        lat: -20.93,
        lng: -66.22,
        communities: ['Telamayu', 'Chocaya', 'Portugalete']
      }
    ],
    polygon: [
      [-17.9, -66.7],
      [-18.4, -65.5],
      [-19.5, -64.9],
      [-21.2, -65.1],
      [-22.2, -65.8],
      [-22.8, -67.2],
      [-21.9, -68.2],
      [-20.4, -68.6],
      [-19.8, -67.7],
      [-19.2, -66.5]
    ]
  },
  {
    name: 'Chuquisaca',
    code: 'CH',
    center: [-19.8, -64.2],
    zoom: 8,
    municipalities: [
      {
        name: 'Camargo',
        province: 'Nor Cinti',
        lat: -20.64,
        lng: -65.21,
        communities: ['Tacaquira', 'Palca Grande', 'San Pedro']
      },
      {
        name: 'Monteagudo',
        province: 'Hernando Siles',
        lat: -19.8,
        lng: -63.95,
        communities: ['Candúa', 'Pedernal', 'Sauces']
      }
    ],
    polygon: [
      [-18.1, -64.4],
      [-19.5, -63.5],
      [-20.1, -62.2],
      [-20.9, -62.7],
      [-21.1, -64.3],
      [-21.2, -65.1],
      [-19.5, -64.9],
      [-18.4, -65.5]
    ]
  },
  {
    name: 'Tarija',
    code: 'TJ',
    center: [-21.6, -63.9],
    zoom: 8,
    municipalities: [
      {
        name: 'Entre Ríos',
        province: "Burnet O'Connor",
        lat: -21.52,
        lng: -64.17,
        communities: ['Salinas', 'Chiquiacá', 'Suaruro']
      },
      {
        name: 'Bermejo',
        province: 'Aniceto Arce',
        lat: -22.73,
        lng: -64.34,
        communities: ['Candado Grande', 'Arrozales', 'Porcelana']
      }
    ],
    polygon: [
      [-21.1, -64.3],
      [-20.9, -62.7],
      [-22.2, -62.6],
      [-22.8, -64.3],
      [-22.2, -65.2],
      [-21.2, -65.1]
    ]
  }
];

export const PROTECTED_AREAS_DEMO: ProtectedArea[] = [
  {
    id: 'AP-DEMO-01',
    name: 'Área Protegida Madidi (Referencial)',
    category: 'Parque Nacional y ANMI (Demostrativo)',
    department: 'La Paz',
    polygon: [
      [-13.5, -68.9],
      [-13.3, -67.8],
      [-14.2, -67.6],
      [-14.7, -68.3],
      [-14.3, -69.0]
    ]
  },
  {
    id: 'AP-DEMO-02',
    name: 'Reserva Pilón Lajas (Referencial)',
    category: 'Reserva de la Biosfera (Demostrativo)',
    department: 'Beni / La Paz',
    polygon: [
      [-14.5, -67.5],
      [-14.6, -66.9],
      [-15.3, -66.8],
      [-15.4, -67.4]
    ]
  },
  {
    id: 'AP-DEMO-03',
    name: 'Parque Noel Kempff Mercado (Referencial)',
    category: 'Parque Nacional (Demostrativo)',
    department: 'Santa Cruz',
    polygon: [
      [-13.6, -61.3],
      [-13.7, -60.3],
      [-14.9, -60.3],
      [-14.8, -61.2]
    ]
  }
];

export const MINING_RIGHTS_DEMO: ReferenceMiningPolygon[] = [
  {
    id: 'DER-DEMO-01',
    code: 'DEMO-AJAM-LP-104',
    name: 'Cuadrícula Referencial Río Kaka (Demo)',
    holderType: 'Registro demostrativo de contrato minero',
    department: 'La Paz',
    municipality: 'Guanay',
    status: 'Registro público simulado',
    polygon: [
      [-15.42, -67.98],
      [-15.42, -67.85],
      [-15.53, -67.85],
      [-15.53, -67.98]
    ]
  },
  {
    id: 'DER-DEMO-02',
    code: 'DEMO-AJAM-OR-219',
    name: 'Área Minera Referencial Huanuni Norte (Demo)',
    holderType: 'Registro demostrativo de derecho preconstituido',
    department: 'Oruro',
    municipality: 'Huanuni',
    status: 'Registro público simulado',
    polygon: [
      [-18.23, -66.9],
      [-18.23, -66.78],
      [-18.34, -66.78],
      [-18.34, -66.9]
    ]
  },
  {
    id: 'DER-DEMO-03',
    code: 'DEMO-AJAM-SC-087',
    name: 'Concesión Referencial Escudo Chiquitano (Demo)',
    holderType: 'Registro demostrativo de prospección',
    department: 'Santa Cruz',
    municipality: 'San Ramón',
    status: 'Registro público simulado',
    polygon: [
      [-16.54, -62.58],
      [-16.54, -62.43],
      [-16.67, -62.43],
      [-16.67, -62.58]
    ]
  }
];

export const RIVERS_DEMO: { name: string; coords: [number, number][] }[] = [
  {
    name: 'Cuenca Río Beni (Referencial)',
    coords: [
      [-16.1, -67.7],
      [-15.4, -67.8],
      [-14.4, -67.5],
      [-13.0, -67.2],
      [-11.5, -66.6],
      [-10.8, -65.4]
    ]
  },
  {
    name: 'Cuenca Río Madre de Dios (Referencial)',
    coords: [
      [-12.4, -68.7],
      [-11.8, -67.6],
      [-11.3, -66.9],
      [-11.0, -66.1]
    ]
  },
  {
    name: 'Cuenca Río Pilcomayo / Desaguadero (Referencial)',
    coords: [
      [-17.4, -68.8],
      [-18.3, -67.3],
      [-18.9, -66.9],
      [-19.8, -66.6]
    ]
  }
];
