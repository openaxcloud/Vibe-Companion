document.getElementById('add-btn').addEventListener('click', addTodo);

function addTodo() {
    const input = document.getElementById('todo-input');
    const todoText = input.value.trim();
    
    if (todoText === '') return;

    const li = document.createElement('li');
    li.textContent = todoText;

    const completeBtn = document.createElement('button');
    completeBtn.textContent = 'Complete';
    completeBtn.addEventListener('click', () => {
        li.classList.toggle('completed');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.classList.add('delete-btn');
    deleteBtn.addEventListener('click', () => {
        li.remove();
    });

    li.appendChild(completeBtn);
    li.appendChild(deleteBtn);
    document.getElementById('todo-list').appendChild(li);

    input.value = '';
}