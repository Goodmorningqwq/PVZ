import Phaser from 'phaser';

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    const roomId = this.registry.get('roomId') || '';
    const playerId = this.registry.get('playerId') || 'anonymous';
    const roomMessage = roomId ? `Room: ${roomId}` : 'No room code in the URL yet';

    this.cameras.main.setBackgroundColor('#102016');

    this.add
      .text(32, 32, 'Joining match...', {
        color: '#f5f5e8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        fontStyle: '700',
      })
      .setScrollFactor(0);

    this.add
      .text(32, 84, roomMessage, {
        color: '#c6d9b8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
      })
      .setScrollFactor(0);

    this.add
      .text(32, 112, `Session: ${playerId}`, {
        color: '#a7b899',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
      })
      .setScrollFactor(0);

    this.add
      .text(32, 160, 'Waiting for the server to acknowledge the room...', {
        color: '#8da07f',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
      })
      .setScrollFactor(0);
  }
}