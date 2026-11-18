/** Un code envoyé à un numéro pour un motif, et le nombre de codes faux saisis pour lui. */
export interface CodeSend {
  readonly sentAt: Date;
  readonly failedAttempts: number;
}
