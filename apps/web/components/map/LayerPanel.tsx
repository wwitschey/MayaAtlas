export default function LayerPanel() {
  return (
    <div style={{ background: "white", padding: 12, borderRadius: 12, width: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Layers</div>
      <label style={{ display: "block", marginBottom: 6 }}>
        <input type="checkbox" defaultChecked /> Sites
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        <input type="checkbox" /> Elevation
      </label>
      <label style={{ display: "block", marginBottom: 6 }}>
        <input type="checkbox" /> Population
      </label>
      <label style={{ display: "block" }}>
        <input type="checkbox" /> Temporal filter
      </label>
    </div>
  );
}
