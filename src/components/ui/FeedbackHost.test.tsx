import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackHost from './FeedbackHost';
import { notify, confirmDialog, promptDialog, inferKind } from '../../lib/feedback';

afterEach(() => cleanup());

describe('inferKind', () => {
  it('classifies legacy alert wording', () => {
    expect(inferKind('Failed to save the lead')).toBe('error');
    expect(inferKind('Invalid email or password.')).toBe('error');
    expect(inferKind('Please select a batch first')).toBe('warning');
    expect(inferKind('Batch assigned successfully!')).toBe('success');
    expect(inferKind('Template copied')).toBe('success');
    expect(inferKind('Server is starting')).toBe('info');
  });
});

describe('notify (toasts)', () => {
  it('shows a message and lets the user dismiss it', async () => {
    render(<FeedbackHost />);
    act(() => { notify.success('Saved the batch'); });
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Saved the batch');
    await userEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(screen.queryByText('Saved the batch')).not.toBeInTheDocument();
  });

  it('announces errors as alerts', async () => {
    render(<FeedbackHost />);
    act(() => { notify('Could not save: network down'); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });

  it('does not stack the same message twice', async () => {
    render(<FeedbackHost />);
    act(() => { notify.info('Heads up'); notify.info('Heads up'); });
    expect(await screen.findAllByText(/Heads up/)).toHaveLength(1);
  });

  it('never opens a native alert when no host is mounted', () => {
    const nativeAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    notify('hello');
    expect(nativeAlert).not.toHaveBeenCalled();
    nativeAlert.mockRestore();
  });
});

describe('confirmDialog', () => {
  it('resolves true when confirmed and focuses the confirm button', async () => {
    render(<FeedbackHost />);
    let result: Promise<boolean> | undefined;
    act(() => { result = confirmDialog({ title: 'Publish', message: 'Publish this post?', confirmLabel: 'Publish' }); });
    const dialog = await screen.findByRole('alertdialog', { name: 'Publish' });
    expect(dialog).toHaveTextContent('Publish this post?');
    const confirm = screen.getByRole('button', { name: 'Publish' });
    await waitFor(() => expect(confirm).toHaveFocus());
    await userEvent.click(confirm);
    await expect(result).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('defaults focus to Cancel for a destructive action and resolves false', async () => {
    render(<FeedbackHost />);
    let result: Promise<boolean> | undefined;
    act(() => { result = confirmDialog({ message: 'Delete "Batch 1"?', danger: true }); });
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    await userEvent.click(cancel);
    await expect(result).resolves.toBe(false);
  });

  it('resolves false on Escape', async () => {
    render(<FeedbackHost />);
    let result: Promise<boolean> | undefined;
    act(() => { result = confirmDialog('Discard changes?'); });
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    await expect(result).resolves.toBe(false);
  });

  it('keeps Tab focus inside the dialog', async () => {
    render(<FeedbackHost />);
    act(() => { void confirmDialog('Continue?'); });
    const confirm = await screen.findByRole('button', { name: 'Confirm' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(confirm).toHaveFocus());
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab();
    expect(confirm).toHaveFocus();
  });

  it('answers "no" for a destructive confirm when nothing is mounted to ask the user', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await expect(confirmDialog('Delete?')).resolves.toBe(false);
    nativeConfirm.mockRestore();
  });
});

describe('promptDialog', () => {
  it('resolves with the typed value', async () => {
    render(<FeedbackHost />);
    let result: Promise<string | null> | undefined;
    act(() => { result = promptDialog({ title: 'New file', message: 'File name', defaultValue: 'a.py' }); });
    const input = await screen.findByRole('textbox');
    expect(input).toHaveValue('a.py');
    await userEvent.clear(input);
    await userEvent.type(input, 'utils.py{Enter}');
    await expect(result).resolves.toBe('utils.py');
  });

  it('resolves null when cancelled', async () => {
    render(<FeedbackHost />);
    let result: Promise<string | null> | undefined;
    act(() => { result = promptDialog('Name?'); });
    await screen.findByRole('textbox');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(result).resolves.toBeNull();
  });

  it('blocks submit and shows the message when validation fails', async () => {
    render(<FeedbackHost />);
    let result: Promise<string | null> | undefined;
    let settled = false;
    act(() => {
      result = promptDialog({ message: 'Amount paid', inputType: 'number', validate: v => (Number(v) > 0 ? null : 'Enter an amount greater than zero.') });
      result.then(() => { settled = true; });
    });
    const input = await screen.findByRole('spinbutton');
    await userEvent.type(input, '0{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('greater than zero');
    expect(settled).toBe(false);
    await userEvent.clear(input);
    await userEvent.type(input, '2500{Enter}');
    await expect(result).resolves.toBe('2500');
  });
});
