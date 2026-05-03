import { DatabasePanel as CanonicalDatabasePanel, DatabasePanelProps } from './ide/DatabasePanel';

interface ExtendedDatabasePanelProps extends DatabasePanelProps {
  onClose?: () => void;
}

export default function DatabasePanel({ onClose: _onClose, ...props }: ExtendedDatabasePanelProps) {
  return <CanonicalDatabasePanel {...props} />;
}
