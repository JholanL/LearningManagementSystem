import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function MyCertificates() {
  return (
    <TodoPage
      title={"My Certificates"}
      icon={"bi-award"}
      goal={"Certificates earned by completing courses."}
      features={[
        "Certificate cards",
        "Printable certificate view (window.print() + @media print CSS)",
        "Show the verification link /verify/:code (optional: QR code)",
      ]}
      apis={["certificatesApi.mine()"]}
      reference={"useFetch() hook"}
    />
  );
}
