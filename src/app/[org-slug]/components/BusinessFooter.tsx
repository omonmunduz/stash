interface BusinessFooterProps {
  orgName: string;
}

export function BusinessFooter({ orgName }: BusinessFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-600">
        <p>
          © {currentYear} {orgName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
