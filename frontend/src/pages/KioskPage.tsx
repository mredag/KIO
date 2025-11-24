import KioskLayout from '../layouts/KioskLayout';
import KioskModeRouter from '../components/kiosk/KioskModeRouter';

export default function KioskPage() {
  return (
    <KioskLayout>
      <KioskModeRouter />
    </KioskLayout>
  );
}
