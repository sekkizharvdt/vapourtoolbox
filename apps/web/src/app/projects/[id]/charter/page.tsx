import ProjectCharterClient from './ProjectCharterClient';

// For static export, we need to provide at least one path
// Actual routing will be handled client-side
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <ProjectCharterClient />;
}
