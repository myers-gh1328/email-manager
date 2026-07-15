import {
  createPwaLifecycle,
  mountPwaUpdatePrompt,
  type PwaLifecycleOptions,
  type PwaUpdatePromptOptions
} from '@myers-gh1328/pwa-lifecycle';

export interface EmailManagerPwaOptions extends PwaLifecycleOptions {
  document?: Document;
}

export async function initializePwaUpdates(options: EmailManagerPwaOptions = {}) {
  const lifecycle = createPwaLifecycle(options);
  await lifecycle.start({
    scriptUrl: '/service-worker.js',
    scope: '/',
    type: 'module',
    updateViaCache: 'none'
  });
  const promptOptions: PwaUpdatePromptOptions = {
    document: options.document,
    title: 'Training Comms update ready',
    message: 'A newer version is ready. Update now to restart with the latest app.',
    updateLabel: 'Update Training Comms',
    laterLabel: 'Later'
  };
  const prompt = mountPwaUpdatePrompt(lifecycle, promptOptions);

  return {
    lifecycle,
    prompt,
    destroy: () => prompt.destroy()
  };
}
