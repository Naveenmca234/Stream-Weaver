import ApiStatus from '../common/ApiStatus';

export default function Topbar() {
  return (
    <header className="topbar">
      <div>
        <p className="topbar-context">
          Data ingestion
        </p>

        <strong>Import workspace</strong>
      </div>

      <ApiStatus />
    </header>
  );
}
