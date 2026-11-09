import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Training | OAKBERRY Ireland',
  description: 'Open the OAKBERRY Ireland training resource.',
};

const trainingArtifactUrl = 'https://claude.ai/artifact/5hHmq5uURoLnG87DG8KxZo';

export default function TrainingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-card sm:p-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-purple-700">
          OAKBERRY Ireland
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Training</h1>
        <p className="mx-auto mt-4 max-w-md text-slate-600">
          Open the training resource using the link below. It will open in a new tab.
        </p>
        <a
          href={trainingArtifactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex rounded-full bg-purple-800 px-7 py-3 font-semibold text-white transition-colors hover:bg-purple-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-800"
        >
          Open training resource
        </a>
      </section>
    </main>
  );
}
