export type BusData = {
  busId: string;
  routeName: string;
  latitude: number;
  longitude: number;
  currentPassengers: number;
  capacity: number;
  entries: number;
  exits: number;
  lastUpdate: string;
  stops: string[];
};
