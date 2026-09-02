type MapMember = {
  id: string;
  name: string;
  initials: string;
  color: string;
  pace: string;
  latitude: number;
  longitude: number;
  isYou?: boolean;
};

type MapDestination = {
  name: string;
  latitude: number;
  longitude: number;
};

export function GroupMap(props: { members: MapMember[]; start: MapDestination; destination: MapDestination; follow?: boolean; fitKey?: number; onGesture?: () => void }): React.ReactElement;
