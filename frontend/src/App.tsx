import VehicleForm from './components/VehicleForm';

// After a successful submit the browser navigates to the backend's /upload page.
export default function App() {
  return (
    <main>
      <h1>Drill Down Form</h1>
      <VehicleForm />
    </main>
  );
}
