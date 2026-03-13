import { Metadata } from 'next';
import ReferenceProjectsClient from './ReferenceProjectsClient';

export const metadata: Metadata = {
  title: 'Reference Projects — Thermal Desalination',
  description:
    'As-built design data from real MED-TVC desalination projects for engineering reference and calculator validation.',
};

export default function ReferenceProjectsPage() {
  return <ReferenceProjectsClient />;
}
