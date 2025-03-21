use std::env::args;
use std::io::{self, BufRead, Write};
use std::process::exit;

fn fib(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        n => fib(n - 1) + fib(n - 2),
    }
}

fn print_help() {
    println!("Trusted Execution Environment Fibonacci Calculator");
    println!("Usage:");
    println!("  - No arguments: Interactive mode");
    println!("  - Number argument (e.g. '10'): Calculate Fibonacci for that number");
    println!("  - 'interactive': Enter interactive mode");
    println!("  - 'help': Show this help message");
    println!("  - 'exit' or 'quit': Exit the program (in interactive mode)");
}

fn process_input(input: &str) -> Option<u32> {
    match input.trim() {
        "help" => {
            print_help();
            None
        }
        "exit" | "quit" => {
            println!("Exiting program");
            exit(0);
        }
        "interactive" => {
            println!("Entering interactive mode...");
            interactive_mode();
            None
        }
        num => {
            match num.parse::<u32>() {
                Ok(n) => {
                    let result = fib(n);
                    println!("Fibonacci sequence number at index {} is {}", n, result);
                    Some(result)
                }
                Err(_) => {
                    println!("Invalid input: '{}'. Please enter a valid non-negative number or command.", num);
                    None
                }
            }
        }
    }
}

fn interactive_mode() {
    println!("Interactive mode. Enter a number to calculate Fibonacci, or 'help', 'exit'.");
    
    let stdin = io::stdin();
    let mut handle = stdin.lock();
    
    loop {
        print!("> ");
        io::stdout().flush().unwrap();
        
        let mut input = String::new();
        if handle.read_line(&mut input).is_err() {
            println!("Error reading input");
            continue;
        }
        
        process_input(&input);
    }
}

fn main() {
    println!("Rust - Fibonacci sequence in TEE");
    
    let args: Vec<String> = args().skip(1).collect();
    
    if args.is_empty() {
        println!("No arguments provided. Entering interactive mode.");
        println!("Type 'help' for usage information.");
        interactive_mode();
    } else {
        for arg in args {
            process_input(&arg);
        }
    }
}