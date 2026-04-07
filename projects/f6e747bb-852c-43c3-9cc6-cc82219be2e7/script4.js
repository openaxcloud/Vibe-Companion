import React from 'react';
import styled from 'styled-components';

const ListContainer = styled.ul`
  list-style: none;
  padding: 0;
`;

const ListItem = styled.li`
  background-color: #1e1e1e;
  margin: 10px 0;
  padding: 10px;
  border-radius: 5px;
  display: flex;
  justify-content: space-between;
`;

const RemoveButton = styled.button`
  background-color: #ff1744;
  border: none;
  border-radius: 5px;
  color: white;
  cursor: pointer;
  padding: 5px 10px;
`;

const TodoList = ({ todos, removeTodo }) => {
  return (
    <ListContainer>
      {todos.map((todo) => (
        <ListItem key={todo.id}>
          {todo.text}
          <RemoveButton onClick={() => removeTodo(todo.id)}>Remove</RemoveButton>
        </ListItem>
      ))}
    </ListContainer>
  );
};

export default TodoList;