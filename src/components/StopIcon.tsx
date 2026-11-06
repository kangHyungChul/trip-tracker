import {
    BedDouble, ShoppingBag, Utensils, Coffee, Camera, Plane, TramFront,
    TrainFront, Bus, CircleParking, Ship, Armchair, Hospital, MapPin,
    Car, Fuel, Umbrella, Mountain, Trees, Landmark, Ticket, Luggage,
} from 'lucide-react';
import { inferStopIcon, STOP_ICON_LABELS, type StopIcon as StopIconName } from '../lib/stopIcons';
import type { Stop } from '../types';

const ICONS = {
    hotel: BedDouble, shopping: ShoppingBag, restaurant: Utensils, cafe: Coffee,
    sightseeing: Camera, airport: Plane, subway: TramFront, train: TrainFront,
    bus: Bus, parking: CircleParking, ferry: Ship, rest: Armchair, hospital: Hospital, other: MapPin,
    car: Car, fuel: Fuel, beach: Umbrella, mountain: Mountain, park: Trees, museum: Landmark, activity: Ticket, luggage: Luggage,
};

export const STOP_ICON_OPTIONS = Object.entries(STOP_ICON_LABELS) as [StopIconName, string][];
export const stopIconName = (stop: Pick<Stop, 'icon' | 'kind'>): StopIconName => stop.icon ?? inferStopIcon(stop.kind);

export function StopIcon({ name, className = 'size-4' }: { name: StopIconName; className?: string }) {
    const Icon = ICONS[name];
    return <Icon className={className} aria-hidden="true" strokeWidth={2.25} />;
}
