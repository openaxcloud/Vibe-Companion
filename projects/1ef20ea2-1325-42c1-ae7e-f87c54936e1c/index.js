// filename: index.js
new Vue({
    el: '#app',
    data: {
        channels: [],
        currentChannel: '',
        messages: [],
        newMessage: ''
    },
    methods: {
        loadChannels() {
            // Placeholder for loading channels from the server
            this.channels = ['general', 'random'];
        },
        selectChannel(channel) {
            this.currentChannel = channel;
            this.loadMessages(channel);
        },
        loadMessages(channel) {
            // Placeholder for loading messages from the server
            this.messages = [
                { user: 'User1', text: 'Hello!' },
                { user: 'User2', text: 'Hi there!' }
            ];
        },
        sendMessage() {
            if (this.newMessage.trim() !== '') {
                this.messages.push({ user: 'Me', text: this.newMessage });
                this.newMessage = '';
                // TODO: Send message to server
            }
        }
    },
    mounted() {
        this.loadChannels();
        this.selectChannel('general');
    }
});