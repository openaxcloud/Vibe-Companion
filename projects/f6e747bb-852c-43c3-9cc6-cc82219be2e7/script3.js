import React, { useState } from 'react';
import styled from 'styled-components';

const FormContainer = styled.form`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
`;

const Input = styled.input`
  padding: 10px;
  border: none;
  border-radius: 5px;
  margin-right: 10px;
  width: 300px;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: #6200ea;
  border: none;
  border-radius: 5px;
  color: white;
  cursor: pointer;
`;

const TodoForm = ({ addTodo }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue) return;
    
    const newTodo = {
      id: Date.now(),
      text: inputValue,
    };
    addTodo(newTodo);
    setInputValue('');
  };

  return (
    <FormContainer onSubmit={handleSubmit}>
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Add a new todo"
      />
      <Button type="submit">Add</Button>
    </FormContainer>
  );
};

export default TodoForm;