// const express = require('express');
import express from 'express';
import fetch from 'node-fetch';
import { catchAsync } from '../utils/wrapperFunction.js';
const app = express();
app.use(express.json());

const GOLD_API_URL = 'https://www.goldapi.io/api/XAU/USD';
const GOLD_API_KEY = 'goldapi-17fvpq19md7hwwbx-io';

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD'; // free API

async function getExchangeRateToEGP() {
    const response = await fetch(EXCHANGE_RATE_API);
    const data = await response.json();
    if (!data.rates || !data.rates.EGP) {
        throw new Error('Failed to fetch USD to EGP exchange rate');
    }
    return data.rates.EGP;
}

async function fetchGoldPrice() {
    const response = await fetch(GOLD_API_URL, {
        method: 'GET',
        headers: {
            'x-access-token': GOLD_API_KEY,
            'Content-Type': 'application/json',
        }
    });
    return await response.json();
}

export const price_gram = catchAsync(async (req, res) => {
    const { karat } = req.params;
    const data = await fetchGoldPrice();
    const egpRate = await getExchangeRateToEGP();

    const priceUsd = data[`price_gram_${karat}k`];
    if (!priceUsd) return res.status(500).json({ error: 'Gold price not found' });

    const priceEgp = priceUsd * egpRate;

    res.json({
        price_per_gram_usd: priceUsd.toFixed(2),
        price_per_gram_egp: priceEgp.toFixed(2),
        egp_rate: egpRate,
        karat: `${karat}k`,
    });
});

export async function calculateTotalProductPrice(karat,weight,makingCharges) {
    const goldData = await fetchGoldPrice();
    const egpRate = await getExchangeRateToEGP();
    console.log(karat, weight, makingCharges);
    if (!weight || !karat || makingCharges === undefined) {
        throw new Error('weight, karat, makingCharges are required');
    }
    

    const karatInt = Number(karat);
    const pricePerGramUsd = goldData[`price_gram_${karatInt}k`];
    console.log('Received karat value:', karat, 'Type:', typeof karat);
    console.log('Karat as integer:', karatInt);
    if (!pricePerGramUsd) throw new Error('Invalid karat price');

    const pricePerGramEgp = pricePerGramUsd * egpRate;
    const totalPrice = (pricePerGramEgp * weight) + makingCharges;

    return {
        gold_price_per_gram_egp: pricePerGramEgp.toFixed(2),
        total_price_egp: totalPrice.toFixed(2),
    };
}
export const calculateProductPrice = catchAsync(async (req, res) => {
    const { karat,weight,makingCharges } = req.body;
    if (!weight || !karat || makingCharges === undefined) {
        return res.status(400).json({ error: 'weight, karat, makingCharges are required' });
    }

    try {
        const priceDetails = await calculateTotalProductPrice(weight, karat, makingCharges);
        res.json(priceDetails);
    } catch (error) {
        console.error('Error calculating product price:', error);
        res.status(500).json({ error: 'Failed to calculate product price' });
    }
});

export const updateProductPrice = catchAsync(async (req, res) => {
    const { karat, weight, makingCharges } = req.body;
    if (!weight || !karat || makingCharges === undefined) {
        return res.status(400).json({ error: 'weight, karat, makingCharges are required' });
    }

    try {
        const priceDetails = await calculateTotalProductPrice(weight, karat, makingCharges);
        res.json(priceDetails);
    } catch (error) {
        console.error('Error updating product price:', error);
        res.status(500).json({ error: 'Failed to update product price' });
    }
});