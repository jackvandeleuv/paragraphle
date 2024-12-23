from copy import copy

class Item:
    def __init__(self, id, string, score):
        assert isinstance(id, int)
        assert isinstance(string, str)
        assert isinstance(score, int)
        self.id = id
        self.string = string
        self.score = score

    def equals(self, other):
        assert isinstance(other, Item)
        return other.string == self.string
    
    def copy(self):
        return Item(
            copy(self.id),
            copy(self.string),
            copy(self.score),
        )
    
    def __str__(self):
        return f'{self.id}, {self.string}, {self.score}'

class Node:
    def __init__(self, left, right, item: Item):
        assert isinstance(item, Item)
        assert not left or isinstance(left, Node)
        assert not right or isinstance(right, Node)
        self.left = left
        self.right = right
        self.item = item

    def copy(self):
        left = self.left
        right = self.right
        if left:
            left = left.copy()
        if right:
            right = right.copy()
        return Node(
            left, right, self.item.copy()
        )
    
    def __str__(self):
        return self.item.__str__()

class BTree:
    def __init__(self):
        self.__head = None

    def __print_recursive(self, here: Node):
        if not here:
            return
        if here.item.string == 'cat':
            print(here.item.string)
        (self.__print_recursive(here.left))
        (self.__print_recursive(here.right))

    def print(self):
        self.__print_recursive(self.__head)

    def find(self, string):
        assert string
        assert isinstance(string, str)

        if not self.__head:
            return None

        here = self.__head
        while here:
            if string == here.item.string:
                return here.copy()

            elif string < here.item.string:
                here = here.left

            elif string > here.item.string:
                here = here.right

        return None

    def insert(self, item: Item):
        assert item
        assert isinstance(item, Item)
        item = item.copy()

        if not self.__head:
            self.__head = Node(None, None, item)
            return
        
        if self.find(item.string):
            return

        here = self.__head

        while True:
            if item.string > here.item.string and here.right:
                here = here.right
                continue

            if item.string < here.item.string and here.left:
                here = here.left
                continue

            if item.string > here.item.string and not here.right:
                here.right = Node(None, None, item.copy())
                return
            
            if item.string < here.item.string and not here.left:
                here.left = Node(None, None, item.copy())
                return
            

